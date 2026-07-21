"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import {
    routeDestinationSchema,
    type RouteDestination,
} from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type FlowLayoutNode = {
    nodeType: string
    nodeId: string
    // nome capturado ao colocar o nó no canvas — só usado pra exibir um card ainda sem nenhuma
    // conexão (fora do GET /flows/:id/graph); nó alcançável usa o nome resolvido ali, mais atual
    name?: string
    x: number
    y: number
}

export type Flow = {
    id: string
    name: string
    companyId: string
    entryDestination: RouteDestination
    layout: FlowLayoutNode[]
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

export type GraphNode = { type: string; id: string; name: string }
export type GraphEdge = {
    from: { type: string; id: string; slot: string }
    to: { type: string; id: string }
}

export type FlowNodeInstance = {
    id: string
    flowId: string
    type: string
    resourceId: string | null
    label: string | null
    position: { x: number; y: number }
    createdAt: string
    updatedAt: string
}

export type FlowNodeEdge = {
    id: string
    flowId: string
    sourceNodeId: string
    sourcePort: string
    targetNodeId: string
    createdAt: string
    updatedAt: string
}

export const createFlowFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    // opcional — na lista só se cria com nome/empresa, o entryDestination é montado depois no
    // canvas (conectar o nó "Início" a algum nó real, ver flow-canvas.tsx)
    entryDestination: routeDestinationSchema.optional(),
})

export type FlowForm = z.infer<typeof createFlowFormSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useFlows(companyId?: string) {
    const [flows, setFlows] = useState<Flow[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchFlows = useCallback(async () => {
        if (!companyId) {
            setFlows([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/flows", { params: { companyId } })
            setFlows(data.flows ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar flows"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createFlow = async (form: FlowForm) => {
        const id = toast.loading("Criando flow...")
        try {
            const { data } = await api.post("/flows", form)
            toast.success("Flow criado", { id })
            await fetchFlows()
            return data.flowId as string
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar flow"), { id })
            return null
        }
    }

    const updateFlow = async (
        flowId: string,
        form: Omit<FlowForm, "companyId">
    ) => {
        const id = toast.loading("Atualizando flow...")
        try {
            await api.put(`/flows/${flowId}`, form)
            toast.success("Flow atualizado", { id })
            await fetchFlows()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar flow"), { id })
            return false
        }
    }

    // autosave de posição no canvas — silencioso (sem toast), não refaz o fetch da lista
    const updateFlowLayout = async (
        flowId: string,
        layout: FlowLayoutNode[]
    ) => {
        try {
            await api.put(`/flows/${flowId}/layout`, { layout })
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao salvar posição do canvas"))
            return false
        }
    }

    const deleteFlow = async (flowId: string) => {
        const id = toast.loading("Deletando flow...")
        try {
            await api.delete(`/flows/${flowId}`)
            toast.success("Flow deletado", { id })
            await fetchFlows()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar flow"), { id })
            return false
        }
    }

    const filtered = flows.filter((f) =>
        f.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({
        fetched: false,
    })

    useEffect(() => {
        if (
            fetchStateRef.current.fetched &&
            fetchStateRef.current.key === companyId
        )
            return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchFlows()
    }, [fetchFlows, companyId])

    return {
        flows: filtered,
        loading,
        filter,
        setFilter,
        fetchFlows,
        createFlow,
        updateFlow,
        updateFlowLayout,
        deleteFlow,
    }
}

// Busca 1 flow por id — usado pela página do editor (canvas), separado da lista paginada de
// useFlows pra não precisar carregar todos os flows da empresa só pra abrir 1.
//
// `loading` só fica true na primeira busca — refetchFlow (chamado a cada save de layout/entry, ver
// flow-canvas.tsx e page.tsx) não pode voltar a marcar loading=true, senão a página desmonta o
// <FlowCanvas> (troca por "Carregando...") e remonta do zero a cada ação do usuário no canvas.
export function useFlow(flowId?: string) {
    const [flow, setFlow] = useState<Flow | null>(null)
    const [loading, setLoading] = useState(true)
    const hasLoadedRef = useRef(false)

    const fetchFlow = useCallback(async () => {
        if (!flowId) {
            setFlow(null)
            setLoading(false)
            return
        }
        if (!hasLoadedRef.current) setLoading(true)
        try {
            const { data } = await api.get(`/flows/${flowId}`)
            setFlow(data.flow ?? null)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar flow"))
        } finally {
            setLoading(false)
            hasLoadedRef.current = true
        }
    }, [flowId])

    useEffect(() => {
        hasLoadedRef.current = false
        fetchFlow()
    }, [fetchFlow])

    return { flow, loading, refetchFlow: fetchFlow }
}

// Só leitura — grafo inteiro alcançável a partir do entryDestination do Flow (ver GET /flows/:id/graph
// no backend). Usado pelo canvas pra desenhar todos os nós, não só o de entrada.
//
// `loading` só fica true na primeira busca (tela cheia de "Carregando..." faz sentido aqui, ainda
// não há nada desenhado) — refetches disparados por conectar/desconectar nós usam `refreshing` em
// vez disso, pra não tampar o canvas inteiro a cada pequena mudança (sensação de "recarregou tudo").
export function useFlowGraph(flowId?: string) {
    const [nodes, setNodes] = useState<GraphNode[]>([])
    const [edges, setEdges] = useState<GraphEdge[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const hasLoadedRef = useRef(false)

    const fetchGraph = useCallback(async () => {
        if (!flowId) {
            setNodes([])
            setEdges([])
            setLoading(false)
            return
        }
        if (hasLoadedRef.current) setRefreshing(true)
        else setLoading(true)
        try {
            const { data } = await api.get(`/flows/${flowId}/graph`)
            setNodes(data.nodes ?? [])
            setEdges(data.edges ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar grafo do flow"))
        } finally {
            setLoading(false)
            setRefreshing(false)
            hasLoadedRef.current = true
        }
    }, [flowId])

    useEffect(() => {
        hasLoadedRef.current = false
        fetchGraph()
    }, [fetchGraph])

    return { nodes, edges, loading, refreshing, refetchGraph: fetchGraph }
}

// Grafo novo: cada item é uma instância do canvas, não o recurso Asterisk. Assim duas instâncias
// podem apontar para a mesma Fila 600 e ainda terem saídas/posições independentes.
export function useFlowNodes(flowId?: string) {
    const [nodes, setNodes] = useState<FlowNodeInstance[]>([])
    const [edges, setEdges] = useState<FlowNodeEdge[]>([])
    const [entryNodeId, setEntryNodeId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const hasLoadedRef = useRef(false)

    const fetchNodes = useCallback(async () => {
        if (!flowId) {
            setNodes([])
            setEdges([])
            setEntryNodeId(null)
            setLoading(false)
            return
        }
        if (hasLoadedRef.current) setRefreshing(true)
        else setLoading(true)
        try {
            const { data } = await api.get(`/flows/${flowId}/nodes`)
            setNodes(data.nodes ?? [])
            setEdges(data.edges ?? [])
            setEntryNodeId(data.entryNodeId ?? null)
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar nós do flow"))
        } finally {
            setLoading(false)
            setRefreshing(false)
            hasLoadedRef.current = true
        }
    }, [flowId])

    useEffect(() => {
        hasLoadedRef.current = false
        fetchNodes()
    }, [fetchNodes])

    return {
        nodes,
        setNodes,
        edges,
        setEdges,
        entryNodeId,
        setEntryNodeId,
        loading,
        refreshing,
        refetchNodes: fetchNodes,
    }
}
