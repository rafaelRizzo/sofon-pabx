"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    applyNodeChanges,
    type Connection,
    type Edge,
    type EdgeTypes,
    type Node,
    type NodeChange,
    type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "@/components/Flows/flow-canvas.css"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
    ROUTE_DEST_ICONS,
    type DestinationOption,
} from "@/components/RouteDestination/route-destination-field"
import { CreateNodeDialog } from "@/components/Flows/create-node-dialog"
import { EditNodeDialog } from "@/components/Flows/edit-node-dialog"
import { NodeActionDialog } from "@/components/Flows/node-action-dialog"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
    DeletableEdge,
    type DeletableEdgeData,
} from "@/components/Flows/deletable-edge"
import {
    FlowNode,
    StartNode,
    type FlowNodeData,
} from "@/components/Flows/flow-node"
import {
    NODE_TYPE_CONFIG,
    NODE_ACTION_LABELS,
    NODE_ACTIONS,
    type CanvasNodeAction,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import {
    useFlowNodes,
    type Flow,
    type FlowNodeEdge,
    type FlowNodeInstance,
} from "@/hooks/use-flows"
import { type Company } from "@/hooks/use-companies"
import {
    savePendingPosition,
    clearPendingPosition,
    savePendingEdgeOp,
    clearPendingEdgeOp,
    loadPendingForFlow,
    clearPendingForNode,
    type EdgeOperation,
} from "@/lib/flow-canvas-db"
import {
    useFlowHistory,
    type HistoryAction,
    type HistoryDirection,
} from "@/components/Flows/flow-history"
import {
    useAnnouncements,
    type AnnouncementForm,
} from "@/hooks/use-announcements"
import { useQueues, type QueueForm, type QueueUpdateForm } from "@/hooks/use-queues"
import {
    useRequestTemplates,
    type RequestTemplateForm,
    type RequestTemplateUpdateForm,
} from "@/hooks/use-request-templates"
import {
    useTimeConditions,
    type TimeConditionForm,
    type TimeConditionCreationDto,
} from "@/hooks/use-time-conditions"
import {
    useHolidayGroups,
    type HolidayGroupForm,
    type HolidayGroupUpdateForm,
} from "@/hooks/use-holiday-groups"
import {
    useVariables,
    type VariableSetForm,
    type VariableSetUpdateForm,
} from "@/hooks/use-variables"
import {
    useVariableConditions,
    type VariableConditionForm,
    type VariableConditionUpdateForm,
} from "@/hooks/use-variable-conditions"

const START_KEY = "start"
const MINI_MAP_IDLE_DELAY = 1200
const EDGE_SYNC_DEBOUNCE_MS = 350
const EDGE_SYNC_MAX_DELAY_MS = 30000
const POSITION_RETRY_BASE_DELAY_MS = 1500
const POSITION_RETRY_MAX_DELAY_MS = 30000

const NODE_TYPES: NodeTypes = {
    flowNode: FlowNode as any,
    startNode: StartNode,
}
const EDGE_TYPES: EdgeTypes = { deletable: DeletableEdge as any }

function edgeStyleForSlot(slot: string) {
    const stroke =
        {
            true: "var(--flow-branch-positive)",
            success: "var(--flow-branch-positive)",
            false: "var(--flow-branch-negative)",
            error: "var(--flow-branch-negative)",
        }[slot]
    return { strokeWidth: 2, ...(stroke && { stroke }) }
}

type Props = {
    flow: Flow
    companies: Company[]
    // Buscado no componente pai (flows.$id.tsx) em paralelo com o flow, pra tela mostrar um único
    // loading em vez de "carrega o flow, depois carrega os nós" em sequência.
    flowNodesState: ReturnType<typeof useFlowNodes>
}

function applyEdgeOperations(
    edges: FlowNodeEdge[],
    operations: Iterable<EdgeOperation>
): FlowNodeEdge[] {
    const byPort = new Map(
        edges.map((edge) => [`${edge.sourceNodeId}:${edge.sourcePort}`, edge])
    )
    const now = new Date().toISOString()
    for (const operation of operations) {
        const key = `${operation.sourceNodeId}:${operation.sourcePort}`
        if (operation.type === "disconnect") {
            byPort.delete(key)
            continue
        }
        const current = byPort.get(key)
        byPort.set(key, {
            id: current?.id ?? `pending:${key}`,
            flowId: current?.flowId ?? "pending",
            sourceNodeId: operation.sourceNodeId,
            sourcePort: operation.sourcePort,
            targetNodeId: operation.targetNodeId,
            createdAt: current?.createdAt ?? now,
            updatedAt: now,
        })
    }
    return [...byPort.values()]
}

function FlowCanvasInner({ flow, companies, flowNodesState }: Props) {
    const {
        nodes: flowNodes,
        setNodes: setFlowNodes,
        edges: flowEdges,
        entryNodeId,
        setEntryNodeId,
        loading,
        refreshing,
        refetchNodes,
        setEdges: setFlowEdges,
    } = flowNodesState
    const [rfNodes, setRfNodes] = useState<Node[]>([])
    const [rfEdges, setRfEdges] = useState<Edge[]>([])
    const [pendingAction, setPendingAction] = useState<CanvasNodeAction | null>(
        null
    )
    const [pendingCreation, setPendingCreation] = useState<{
        type: CanvasNodeType
        source?: { nodeId: string; port: string }
    } | null>(null)
    const [editingNode, setEditingNode] = useState<{
        nodeId: string
        type: CanvasNodeType
        resourceId: string
        name: string
    } | null>(null)
    const [resourceToDelete, setResourceToDelete] = useState<{
        nodeId: string
        type: CanvasNodeType
        resourceId: string
        name: string
        creationDto: unknown
    } | null>(null)
    // "Início do flow" é sintético (não é um FlowNode no banco, não tem id real) — a posição dele
    // não cabe no PUT /nodes/:nodeId. Usa o campo Flow.layout (já existia no schema, sem uso até
    // agora) só pra esse único item.
    const [startPosition, setStartPosition] = useState<{ x: number; y: number }>(
        () => {
            const saved = flow.layout?.find((item) => item.nodeId === START_KEY)
            return saved ? { x: saved.x, y: saved.y } : { x: 80, y: 40 }
        }
    )
    const startSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingPositions = useRef(new Map<string, { x: number; y: number }>())
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const edgeSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const edgeSyncInFlight = useRef(false)
    const edgeSyncBackoff = useRef(EDGE_SYNC_DEBOUNCE_MS)
    const edgeSyncErrorNotified = useRef(false)
    const positionRetryBackoff = useRef(POSITION_RETRY_BASE_DELAY_MS)
    const positionErrorNotified = useRef(false)
    const pendingEdgeOperations = useRef(new Map<string, EdgeOperation>())
    const pendingNodeIds = useRef(new Set<string>())
    const flushEdgeOperationsRef = useRef<() => void>(() => { })
    const hydratedFlowRef = useRef<string | null>(null)
    const miniMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isMiniMapVisible, setIsMiniMapVisible] = useState(true)
    const [isSyncingEdges, setIsSyncingEdges] = useState(false)
    const canvasRootRef = useRef<HTMLDivElement>(null)

    // Histórico undo/redo (ver flow-history.ts) — em memória, zerado ao desmontar (trocar de flow
    // ou recarregar a página).
    const history = useFlowHistory()

    // Ids de nó recriados por undo/redo (o backend nunca restaura o id excluído — recriar sempre
    // gera um id novo). Encadeia ida->novo pra qualquer outra ação da pilha (ex. um move-node ou
    // connect-edge anterior) resolver pro id vivo atual em vez do id histórico já morto.
    const nodeIdMapRef = useRef(new Map<string, string>())
    const resolveNodeId = useCallback((id: string) => {
        let current = id
        const seen = new Set<string>()
        while (nodeIdMapRef.current.has(current) && !seen.has(current)) {
            seen.add(current)
            current = nodeIdMapRef.current.get(current)!
        }
        return current
    }, [])

    // Espelhos em ref do estado corrente — usados pelos comandos de mutação (commitNodePosition,
    // deleteNode, deleteResource, connectNodes) pra ler o valor mais recente sem precisar desses
    // valores na lista de dependências do useCallback (evita recriar esses comandos, e portanto
    // onNodesChange/rfNodes, a cada mudança de estado).
    const flowNodesRef = useRef<FlowNodeInstance[]>([])
    const flowEdgesRef = useRef<FlowNodeEdge[]>([])
    const entryNodeIdRef = useRef<string | null>(null)
    useEffect(() => {
        flowNodesRef.current = flowNodes
    }, [flowNodes])
    useEffect(() => {
        flowEdgesRef.current = flowEdges
    }, [flowEdges])
    useEffect(() => {
        entryNodeIdRef.current = entryNodeId
    }, [entryNodeId])

    // Hooks de criação por tipo de recurso — usados só pra recriar um recurso excluído/desfeito
    // (ver recreateResource abaixo). O form de edição/criação de cada tipo já usa esses mesmos
    // hooks em edit-node-dialog.tsx/create-node-dialog.tsx.
    const { createAnnouncement } = useAnnouncements()
    const { createQueue } = useQueues()
    const { createRequestTemplate } = useRequestTemplates()
    const { createTimeCondition } = useTimeConditions()
    const { createHolidayGroup } = useHolidayGroups()
    const { createVariableSet } = useVariables()
    const { createVariableCondition } = useVariableConditions()

    const showMiniMap = useCallback(() => {
        if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        setIsMiniMapVisible(true)
    }, [])

    const scheduleMiniMapHide = useCallback(() => {
        if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        miniMapTimer.current = setTimeout(
            () => setIsMiniMapVisible(false),
            MINI_MAP_IDLE_DELAY
        )
    }, [])

    useEffect(() => {
        scheduleMiniMapHide()
        return () => {
            if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        }
    }, [scheduleMiniMapHide])

    const nodeById = useMemo(
        () => new Map(flowNodes.map((node) => [node.id, node])),
        [flowNodes]
    )

    // referência sempre atual dos ids de nó válidos — usada dentro de callbacks memoizados
    // (persistPositions) pra não reenfileirar posição de um nó já deletado numa race entre o PUT
    // em voo e um delete concorrente.
    const nodeIdsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        nodeIdsRef.current = new Set(flowNodes.map((node) => node.id))
    }, [flowNodes])

    const scheduleEdgeSync = useCallback((delay = EDGE_SYNC_DEBOUNCE_MS) => {
        if (edgeSyncTimer.current) clearTimeout(edgeSyncTimer.current)
        edgeSyncTimer.current = setTimeout(
            () => flushEdgeOperationsRef.current(),
            delay
        )
    }, [])

    const flushEdgeOperations = useCallback(async () => {
        if (
            edgeSyncInFlight.current ||
            pendingEdgeOperations.current.size === 0
        )
            return

        const operations = [...pendingEdgeOperations.current.values()].filter(
            (operation) =>
                !pendingNodeIds.current.has(operation.sourceNodeId) &&
                (operation.type === "disconnect" ||
                    !pendingNodeIds.current.has(operation.targetNodeId))
        )
        if (operations.length === 0) return
        edgeSyncInFlight.current = true
        setIsSyncingEdges(true)
        for (const operation of operations)
            pendingEdgeOperations.current.delete(
                `${operation.sourceNodeId}:${operation.sourcePort}`
            )
        try {
            const { data } = await api.put(
                `/flows/${flow.id}/node-edges/batch`,
                {
                    operations,
                }
            )
            for (const operation of operations)
                void clearPendingEdgeOp(
                    flow.id,
                    `${operation.sourceNodeId}:${operation.sourcePort}`
                )
            setFlowEdges((current) =>
                applyEdgeOperations(
                    data.edges ?? current,
                    pendingEdgeOperations.current.values()
                )
            )
            edgeSyncBackoff.current = EDGE_SYNC_DEBOUNCE_MS
            edgeSyncErrorNotified.current = false
            edgeSyncInFlight.current = false
            setIsSyncingEdges(false)
            if (pendingEdgeOperations.current.size > 0) scheduleEdgeSync(0)
        } catch (err) {
            for (const operation of operations)
                pendingEdgeOperations.current.set(
                    `${operation.sourceNodeId}:${operation.sourcePort}`,
                    operation
                )
            try {
                const { data } = await api.get(`/flows/${flow.id}/nodes`)
                setFlowEdges(
                    applyEdgeOperations(
                        data.edges ?? [],
                        pendingEdgeOperations.current.values()
                    )
                )
            } catch {
                await refetchNodes()
            }
            if (!edgeSyncErrorNotified.current) {
                edgeSyncErrorNotified.current = true
                toast.error(apiError(err, "Erro ao sincronizar conexões"))
            }
            edgeSyncInFlight.current = false
            setIsSyncingEdges(false)
            // backoff exponencial — sem isso, uma falha persistente (rota fora do ar, 404) vira
            // retry imediato em loop infinito martelando o backend.
            const delay = edgeSyncBackoff.current
            edgeSyncBackoff.current = Math.min(delay * 2, EDGE_SYNC_MAX_DELAY_MS)
            scheduleEdgeSync(delay)
        }
    }, [flow.id, refetchNodes, scheduleEdgeSync, setFlowEdges])

    useEffect(() => {
        flushEdgeOperationsRef.current = () => void flushEdgeOperations()
        return () => {
            if (edgeSyncTimer.current) clearTimeout(edgeSyncTimer.current)
            flushEdgeOperationsRef.current()
        }
    }, [flushEdgeOperations])

    const queueEdgeOperation = useCallback(
        (operation: EdgeOperation) => {
            const key = `${operation.sourceNodeId}:${operation.sourcePort}`
            pendingEdgeOperations.current.set(key, operation)
            void savePendingEdgeOp(flow.id, key, operation)
            setFlowEdges((current) => applyEdgeOperations(current, [operation]))
            scheduleEdgeSync()
        },
        [flow.id, scheduleEdgeSync, setFlowEdges]
    )

    const disconnectNodes = useCallback(
        (sourceNodeId: string, sourcePort: string) =>
            queueEdgeOperation({
                type: "disconnect",
                sourceNodeId,
                sourcePort,
            }),
        [queueEdgeOperation]
    )

    const deleteEdge = useCallback(
        async (edgeId: string) => {
            try {
                const edge = flowEdgesRef.current.find(
                    (item) => item.id === edgeId
                )
                if (!edge) return
                disconnectNodes(edge.sourceNodeId, edge.sourcePort)
                history.push({
                    kind: "disconnect-edge",
                    sourceNodeId: edge.sourceNodeId,
                    sourcePort: edge.sourcePort,
                    targetNodeId: edge.targetNodeId,
                })
            } catch (err) {
                toast.error(apiError(err, "Erro ao remover conexão"))
            }
        },
        [disconnectNodes, history]
    )

    const reconcileNodes = useCallback(async () => {
        const { data } = await api.get(`/flows/${flow.id}/nodes`)
        setFlowNodes(data.nodes ?? [])
        setFlowEdges(data.edges ?? [])
        setEntryNodeId(data.entryNodeId ?? null)
    }, [flow.id, setEntryNodeId, setFlowEdges, setFlowNodes])

    const persistPositions = useCallback(async () => {
        // Nó recém-criado ainda não tem id real do backend (pending:<uuid>) — manda a posição dele
        // pro PUT/:nodeId 400 na validação (regex de cuid). Segura essa entrada até createNode
        // resolver o id de verdade e remapear (ver .then() de createNode).
        const entries = [...pendingPositions.current.entries()].filter(
            ([id]) => !pendingNodeIds.current.has(id)
        )
        if (entries.length === 0) return
        for (const [id] of entries) pendingPositions.current.delete(id)

        // allSettled, não all: um único id "zumbi" (nó deletado/nunca criado) não pode arrastar de
        // volta pro retry as posições que salvaram com sucesso no mesmo lote — Promise.all rejeitaria
        // o array inteiro por causa de 1 falha, fazendo entries que já deram 200 serem reenviadas
        // pra sempre junto do id que nunca vai vingar.
        const results = await Promise.allSettled(
            entries.map(([id, position]) =>
                api.put(`/flows/${flow.id}/nodes/${id}`, { position })
            )
        )

        let firstError: unknown
        for (let i = 0; i < entries.length; i++) {
            const [id, position] = entries[i]
            const result = results[i]
            if (result.status === "fulfilled") {
                void clearPendingPosition(flow.id, id)
                continue
            }
            firstError ??= result.reason
            // se o nó foi deletado enquanto o PUT estava em voo, não reenfileira a posição dele —
            // senão o retry martela pra sempre um nodeId que não existe mais.
            if (nodeIdsRef.current.has(id) || pendingNodeIds.current.has(id))
                pendingPositions.current.set(id, position)
            else void clearPendingPosition(flow.id, id)
        }

        if (firstError === undefined) {
            positionRetryBackoff.current = POSITION_RETRY_BASE_DELAY_MS
            positionErrorNotified.current = false
        } else {
            // backoff exponencial — sem isso, uma falha persistente (rota fora do ar, 404) vira
            // retry imediato em loop infinito martelando o backend.
            const delay = positionRetryBackoff.current
            positionRetryBackoff.current = Math.min(
                delay * 2,
                POSITION_RETRY_MAX_DELAY_MS
            )
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => void persistPositions(), delay)
            try {
                await reconcileNodes()
            } catch {
                // O próximo carregamento busca o estado autoritativo.
            }
            if (!positionErrorNotified.current) {
                positionErrorNotified.current = true
                toast.error(apiError(firstError, "Erro ao salvar posição dos nós"))
            }
        }
    }, [flow.id, reconcileNodes])

    const removeNodeFromCanvas = useCallback(
        (nodeId: string) => {
            setFlowNodes((current) =>
                current.filter((node) => node.id !== nodeId)
            )
            setFlowEdges((current) =>
                current.filter(
                    (edge) =>
                        edge.sourceNodeId !== nodeId &&
                        edge.targetNodeId !== nodeId
                )
            )
            setEntryNodeId((current) => (current === nodeId ? null : current))
            for (const [key, operation] of pendingEdgeOperations.current)
                if (
                    operation.sourceNodeId === nodeId ||
                    (operation.type === "connect" &&
                        operation.targetNodeId === nodeId)
                )
                    pendingEdgeOperations.current.delete(key)
            pendingPositions.current.delete(nodeId)
            void clearPendingForNode(flow.id, nodeId)
        },
        [flow.id, setEntryNodeId, setFlowEdges, setFlowNodes]
    )

    // Chamada crua de exclusão de nó, sem snapshot/histórico — reaproveitada tanto pela exclusão
    // interativa (deleteNode abaixo) quanto pelo replay de undo/redo (applyHistoryAction), que já
    // fez seu próprio removeNodeFromCanvas e só precisa do resultado awaitable da chamada HTTP.
    const deleteNodeCore = useCallback(
        async (nodeId: string) => {
            if (pendingNodeIds.current.has(nodeId)) return true
            try {
                await api.delete(`/flows/${flow.id}/nodes/${nodeId}`)
                toast.success("Nó removido")
                return true
            } catch (err) {
                try {
                    await reconcileNodes()
                } catch {
                    // O próximo carregamento busca o estado autoritativo.
                }
                toast.error(apiError(err, "Erro ao remover nó"))
                return false
            }
        },
        [flow.id, reconcileNodes]
    )

    const deleteNode = useCallback(
        (nodeId: string) => {
            const node = flowNodesRef.current.find((item) => item.id === nodeId)
            if (!node) return Promise.resolve(false)
            const incomingEdges = flowEdgesRef.current.filter(
                (edge) => edge.targetNodeId === nodeId
            )
            const outgoingEdges = flowEdgesRef.current.filter(
                (edge) => edge.sourceNodeId === nodeId
            )
            const wasEntry = entryNodeIdRef.current === nodeId
            removeNodeFromCanvas(nodeId)
            history.push({
                kind: "delete-node",
                node,
                incomingEdges,
                outgoingEdges,
                wasEntry,
            })
            return deleteNodeCore(nodeId)
        },
        [removeNodeFromCanvas, history, deleteNodeCore]
    )

    // Idem deleteNodeCore, mas pros 3 passos de exclusão de recurso (check + delete node + delete
    // recurso) — reaproveitado pela exclusão interativa (deleteResource) e pelo replay de
    // undo/redo (redo de delete-resource, undo de create-resource-node).
    const deleteResourceCore = useCallback(
        async (target: {
            nodeId: string
            type: CanvasNodeType
            resourceId: string
        }) => {
            try {
                await api.post(
                    `/flows/${flow.id}/nodes/${target.nodeId}/resource-deletion-check`
                )
                await api.delete(`/flows/${flow.id}/nodes/${target.nodeId}`)
                await api.delete(
                    `/${NODE_TYPE_CONFIG[target.type].apiPath}/${target.resourceId}`
                )
                toast.success("Recurso e nó excluídos")
                return true
            } catch (err) {
                try {
                    await reconcileNodes()
                } catch {
                    // O próximo carregamento busca o estado autoritativo.
                }
                toast.error(apiError(err, "Erro ao excluir recurso"))
                return false
            }
        },
        [flow.id, reconcileNodes]
    )

    const deleteResource = useCallback(async () => {
        if (!resourceToDelete) return false
        const target = resourceToDelete
        setResourceToDelete(null)
        setEditingNode(null)
        const node = flowNodesRef.current.find(
            (item) => item.id === target.nodeId
        )
        if (!node) return false
        const incomingEdges = flowEdgesRef.current.filter(
            (edge) => edge.targetNodeId === target.nodeId
        )
        const outgoingEdges = flowEdgesRef.current.filter(
            (edge) => edge.sourceNodeId === target.nodeId
        )
        const wasEntry = entryNodeIdRef.current === target.nodeId
        removeNodeFromCanvas(target.nodeId)
        history.push({
            kind: "delete-resource",
            node,
            resourceType: target.type,
            creationDto: target.creationDto,
            incomingEdges,
            outgoingEdges,
            wasEntry,
        })
        void deleteResourceCore(target)
        return true
    }, [resourceToDelete, removeNodeFromCanvas, history, deleteResourceCore])

    const connectNodes = useCallback(
        (sourceNodeId: string, sourcePort: string, targetNodeId: string) => {
            const previous = flowEdgesRef.current.find(
                (edge) =>
                    edge.sourceNodeId === sourceNodeId &&
                    edge.sourcePort === sourcePort
            )
            const previousTargetNodeId = previous?.targetNodeId ?? null
            queueEdgeOperation({
                type: "connect",
                sourceNodeId,
                sourcePort,
                targetNodeId,
            })
            if (previousTargetNodeId !== targetNodeId)
                history.push({
                    kind: "connect-edge",
                    sourceNodeId,
                    sourcePort,
                    targetNodeId,
                    previousTargetNodeId,
                })
        },
        [queueEdgeOperation, history]
    )

    // Retornam Promise<boolean> (nunca rejeitam) — o replay de undo/redo (applyHistoryAction)
    // precisa saber se a chamada deu certo pra decidir se a ação volta pra pilha; os chamadores
    // interativos (onConnect etc.) seguem ignorando o retorno como antes.
    const setEntry = useCallback(
        (nodeId: string) => {
            const from = entryNodeIdRef.current
            setEntryNodeId(nodeId)
            history.push({ kind: "change-entry", from, to: nodeId })
            return api
                .put(`/flows/${flow.id}/nodes/${nodeId}`, { isEntry: true })
                .then(
                    () => true,
                    async (err) => {
                        try {
                            await reconcileNodes()
                        } catch {
                            // O próximo carregamento busca o estado autoritativo.
                        }
                        toast.error(
                            apiError(err, "Erro ao definir início do flow")
                        )
                        return false
                    }
                )
        },
        [flow.id, reconcileNodes, setEntryNodeId, history]
    )

    const clearEntry = useCallback(
        (nodeId: string) => {
            const from = entryNodeIdRef.current
            setEntryNodeId((current) => (current === nodeId ? null : current))
            history.push({ kind: "change-entry", from, to: null })
            return api
                .put(`/flows/${flow.id}/nodes/${nodeId}`, { isEntry: false })
                .then(
                    () => true,
                    async (err) => {
                        try {
                            await reconcileNodes()
                        } catch {
                            // O próximo carregamento busca o estado autoritativo.
                        }
                        toast.error(
                            apiError(err, "Erro ao remover início do flow")
                        )
                        return false
                    }
                )
        },
        [flow.id, reconcileNodes, setEntryNodeId, history]
    )

    // Recria um recurso a partir do DTO de criação capturado antes da exclusão (ver
    // toXCreationDto nos hooks use-*.ts e onDeleteResource em edit-node-dialog.tsx/create-node-dialog.tsx)
    // — usado só pelo histórico de undo/redo (recriar recurso excluído, ou recriar recurso cuja
    // criação foi desfeita). companyId nunca vem do DTO: a recriação sempre cai na empresa do
    // próprio flow. extension/flow nunca chegam aqui (creatable:false e sem exclusão de recurso,
    // ver NODE_TYPE_CONFIG/edit-node-dialog.tsx) — cobertos só pra exaustividade do switch.
    const recreateResource = useCallback(
        async (
            type: CanvasNodeType,
            creationDto: unknown,
            companyId: string
        ): Promise<string | null> => {
            switch (type) {
                case "announcement":
                    return createAnnouncement(
                        creationDto as AnnouncementForm,
                        companyId,
                        true
                    )
                case "queue":
                    return createQueue(
                        {
                            ...(creationDto as QueueUpdateForm),
                            companyId,
                        } as QueueForm,
                        true
                    )
                case "request":
                    return createRequestTemplate(
                        {
                            ...(creationDto as RequestTemplateUpdateForm),
                            companyId,
                        } as RequestTemplateForm,
                        companyId,
                        true
                    )
                case "timecondition":
                    return createTimeCondition(
                        {
                            ...(creationDto as TimeConditionCreationDto),
                            companyId,
                        } as TimeConditionForm,
                        true
                    )
                case "holiday":
                    return createHolidayGroup(
                        {
                            ...(creationDto as HolidayGroupUpdateForm),
                            companyId,
                        } as HolidayGroupForm,
                        true
                    )
                case "variable-set":
                    return createVariableSet(
                        {
                            ...(creationDto as VariableSetUpdateForm),
                            companyId,
                        } as VariableSetForm,
                        true
                    )
                case "variable-condition":
                    return createVariableCondition(
                        {
                            ...(creationDto as VariableConditionUpdateForm),
                            companyId,
                        } as VariableConditionForm,
                        true
                    )
                case "extension":
                case "flow":
                    return null
            }
        },
        [
            createAnnouncement,
            createQueue,
            createRequestTemplate,
            createTimeCondition,
            createHolidayGroup,
            createVariableSet,
            createVariableCondition,
        ]
    )

    // Retorna o id local otimista imediatamente (contrato síncrono já usado pelos chamadores
    // interativos, ex. conectar na sequência) e, à parte, `result` — promise que resolve o
    // sucesso/falha da criação de verdade. `applyHistoryAction` usa `result` pra saber se um
    // redo/undo de criação deu certo; os chamadores interativos seguem ignorando `result`.
    const createNode = useCallback(
        (
            type: CanvasNodeType,
            option: DestinationOption,
            position: { x: number; y: number }
        ): {
            localId: string
            result: Promise<{ ok: true; nodeId: string } | { ok: false }>
        } => {
            const localId = `pending:${crypto.randomUUID()}`
            const now = new Date().toISOString()
            pendingNodeIds.current.add(localId)
            setFlowNodes((current) => [
                ...current,
                {
                    id: localId,
                    flowId: flow.id,
                    type,
                    resourceId: option.id,
                    label: option.label,
                    position,
                    createdAt: now,
                    updatedAt: now,
                } satisfies FlowNodeInstance,
            ])

            const result = api
                .post(`/flows/${flow.id}/nodes`, {
                    type,
                    resourceId: option.id,
                    label: option.label,
                    position,
                })
                .then(({ data }) => {
                    const nodeId = data.nodeId as string
                    pendingNodeIds.current.delete(localId)
                    nodeIdMapRef.current.set(localId, nodeId)
                    setFlowNodes((current) =>
                        current.map((node) =>
                            node.id === localId ? { ...node, id: nodeId } : node
                        )
                    )
                    if (pendingPositions.current.has(localId)) {
                        const localPosition = pendingPositions.current.get(localId)!
                        pendingPositions.current.delete(localId)
                        pendingPositions.current.set(nodeId, localPosition)
                        void clearPendingPosition(flow.id, localId)
                        void savePendingPosition(flow.id, nodeId, localPosition)
                    }
                    setFlowEdges((current) =>
                        current.map((edge) => ({
                            ...edge,
                            sourceNodeId:
                                edge.sourceNodeId === localId
                                    ? nodeId
                                    : edge.sourceNodeId,
                            targetNodeId:
                                edge.targetNodeId === localId
                                    ? nodeId
                                    : edge.targetNodeId,
                        }))
                    )
                    for (const [key, operation] of Array.from(
                        pendingEdgeOperations.current
                    )) {
                        const sourceNodeId =
                            operation.sourceNodeId === localId
                                ? nodeId
                                : operation.sourceNodeId
                        const targetNodeId =
                            operation.type === "connect" &&
                                operation.targetNodeId === localId
                                ? nodeId
                                : operation.type === "connect"
                                    ? operation.targetNodeId
                                    : null
                        if (
                            sourceNodeId === operation.sourceNodeId &&
                            targetNodeId ===
                            (operation.type === "connect"
                                ? operation.targetNodeId
                                : null)
                        )
                            continue
                        const next: EdgeOperation =
                            operation.type === "connect"
                                ? {
                                    ...operation,
                                    sourceNodeId,
                                    targetNodeId: targetNodeId!,
                                }
                                : { ...operation, sourceNodeId }
                        const nextKey = `${next.sourceNodeId}:${next.sourcePort}`
                        pendingEdgeOperations.current.delete(key)
                        pendingEdgeOperations.current.set(nextKey, next)
                        void clearPendingEdgeOp(flow.id, key)
                        void savePendingEdgeOp(flow.id, nextKey, next)
                    }
                    scheduleEdgeSync(0)
                    if (saveTimer.current) clearTimeout(saveTimer.current)
                    saveTimer.current = setTimeout(() => void persistPositions(), 0)
                    return { ok: true as const, nodeId }
                })
                .catch(async (err) => {
                    pendingNodeIds.current.delete(localId)
                    // criação falhou — o nó nunca existiu no backend, então qualquer posição
                    // enfileirada pra ele (arraste rápido antes do erro) precisa sumir junto, senão
                    // persistPositions fica retentando PUT /nodes/pending:<uuid> pra sempre.
                    pendingPositions.current.delete(localId)
                    void clearPendingPosition(flow.id, localId)
                    for (const [
                        key,
                        operation,
                    ] of pendingEdgeOperations.current)
                        if (
                            operation.sourceNodeId === localId ||
                            (operation.type === "connect" &&
                                operation.targetNodeId === localId)
                        ) {
                            pendingEdgeOperations.current.delete(key)
                            void clearPendingEdgeOp(flow.id, key)
                        }
                    try {
                        const { data } = await api.get(
                            `/flows/${flow.id}/nodes`
                        )
                        setFlowNodes(data.nodes ?? [])
                        setFlowEdges(data.edges ?? [])
                    } catch {
                        setFlowNodes((current) =>
                            current.filter((node) => node.id !== localId)
                        )
                        setFlowEdges((current) =>
                            current.filter(
                                (edge) =>
                                    edge.sourceNodeId !== localId &&
                                    edge.targetNodeId !== localId
                            )
                        )
                    }
                    toast.error(apiError(err, "Erro ao adicionar nó"))
                    return { ok: false as const }
                })

            return { localId, result }
        },
        [flow.id, persistPositions, scheduleEdgeSync, setFlowEdges, setFlowNodes]
    )

    useEffect(() => {
        const nodes: Node[] = [
            {
                id: START_KEY,
                type: "startNode",
                position: startPosition,
                data: {},
                deletable: false,
            },
        ]
        for (const node of flowNodes) {
            const config = NODE_TYPE_CONFIG[node.type as CanvasNodeType]
            const outgoing = flowEdges.filter(
                (edge) => edge.sourceNodeId === node.id
            )
            const slots = [
                ...new Set([
                    ...(config?.staticSlots ?? []),
                    ...outgoing.map((edge) => edge.sourcePort),
                ]),
            ]
            const slotTargets: NonNullable<FlowNodeData["slotTargets"]> = {}
            for (const edge of outgoing) {
                const target = nodeById.get(edge.targetNodeId)
                if (target)
                    slotTargets[edge.sourcePort] = {
                        type: target.type,
                        id: target.resourceId ?? target.id,
                        name: target.label ?? target.resourceId ?? "Nó",
                    }
            }
            nodes.push({
                id: node.id,
                type: "flowNode",
                position: node.position,
                data: {
                    nodeType: node.type as FlowNodeData["nodeType"],
                    resourceId: node.resourceId,
                    actionLabel:
                        NODE_ACTION_LABELS[node.type as CanvasNodeType] ??
                        "Executar ação",
                    name: node.label ?? node.resourceId ?? "Nó sem recurso",
                    slots,
                    companyId: flow.companyId,
                    slotTargets,
                    onRemove: deleteNode,
                    onConnectSlot: async (slot, type, resourceId, label) => {
                        const source = nodeById.get(node.id)
                        if (!source) return
                        const position = {
                            x: node.position.x + 280,
                            y: node.position.y + 70,
                        }
                        const { localId } = createNode(
                            type,
                            { id: resourceId, label },
                            position
                        )
                        history.push({
                            kind: "create-node",
                            nodeId: localId,
                            type,
                            resourceId,
                            label: label ?? null,
                            position,
                        })
                        connectNodes(source.id, slot, localId)
                    },
                    onDisconnectSlot: async (slot) => {
                        const edge = outgoing.find(
                            (item) => item.sourcePort === slot
                        )
                        if (edge) await deleteEdge(edge.id)
                    },
                    onCreateSlot: (slot, type) =>
                        setPendingCreation({
                            type,
                            source: { nodeId: node.id, port: slot },
                        }),
                    onEdit: () => {
                        if (node.resourceId)
                            setEditingNode({
                                nodeId: node.id,
                                type: node.type as CanvasNodeType,
                                resourceId: node.resourceId,
                                name: node.label ?? node.resourceId,
                            })
                    },
                } satisfies FlowNodeData as any,
            })
        }

        const edges: Edge[] = flowEdges.map((edge) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            sourceHandle: edge.sourcePort,
            target: edge.targetNodeId,
            type: "deletable",
            style: edgeStyleForSlot(edge.sourcePort),
            data: {
                onDelete: () => deleteEdge(edge.id),
            } satisfies DeletableEdgeData,
        }))
        if (entryNodeId)
            edges.push({
                id: `start-${entryNodeId}`,
                source: START_KEY,
                sourceHandle: "entry",
                target: entryNodeId,
                type: "deletable",
                style: edgeStyleForSlot("entry"),
                data: {
                    onDelete: () => clearEntry(entryNodeId),
                } satisfies DeletableEdgeData,
            })
        setRfNodes(nodes)
        setRfEdges(edges)
    }, [
        flowNodes,
        flowEdges,
        entryNodeId,
        flow.companyId,
        startPosition,
        nodeById,
        createNode,
        connectNodes,
        deleteEdge,
        deleteNode,
        clearEntry,
        history,
    ])

    // Aplica e persiste a posição de um nó comum, com o mesmo debounce/pending-queue de sempre —
    // reaproveitado tanto pelo settle do arraste interativo (onNodesChange abaixo) quanto pelo
    // replay de undo/redo (applyHistoryAction), que chama com flushDelay:0 (ação explícita do
    // usuário, sem motivo pra esperar mais 450ms). Só registra histórico (move-node) quando a
    // posição de fato muda, e nunca durante o replay (history.push já é no-op nesse caso).
    const commitNodePosition = useCallback(
        (nodeId: string, position: { x: number; y: number }, flushDelay = 450) => {
            const previous = flowNodesRef.current.find(
                (node) => node.id === nodeId
            )?.position
            setFlowNodes((current) =>
                current.map((node) =>
                    node.id === nodeId ? { ...node, position } : node
                )
            )
            pendingPositions.current.set(nodeId, position)
            void savePendingPosition(flow.id, nodeId, position)
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(
                () => void persistPositions(),
                flushDelay
            )
            if (previous && (previous.x !== position.x || previous.y !== position.y))
                history.push({ kind: "move-node", nodeId, from: previous, to: position })
        },
        [flow.id, persistPositions, setFlowNodes, history]
    )

    // Idem, pro nó sintético Início (posição guardada à parte, ver comentário de startPosition
    // acima) — mesmo padrão de flushDelay/push de histórico.
    const commitStartPosition = useCallback(
        (position: { x: number; y: number }, flushDelay = 450) => {
            setStartPosition((previous) => {
                if (previous.x !== position.x || previous.y !== position.y)
                    history.push({ kind: "move-start", from: previous, to: position })
                return position
            })
            if (startSaveTimer.current) clearTimeout(startSaveTimer.current)
            startSaveTimer.current = setTimeout(() => {
                void api
                    .put(`/flows/${flow.id}/layout`, {
                        layout: [
                            {
                                nodeType: "start",
                                nodeId: START_KEY,
                                x: position.x,
                                y: position.y,
                            },
                        ],
                    })
                    .catch((err) => {
                        toast.error(
                            apiError(
                                err,
                                "Erro ao salvar posição do início do flow"
                            )
                        )
                    })
            }, flushDelay)
        },
        [flow.id, history]
    )

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setRfNodes((current) => applyNodeChanges(changes, current))
            // dragging=true dispara em toda posição intermediária do arraste — só commitamos em
            // flowNodes (o que retrigger o rebuild do canvas inteiro) quando o gesto termina, senão
            // pisca a cada frame brigando com a própria animação do React Flow.
            const settled = changes.filter(
                (change): change is Extract<NodeChange, { type: "position" }> =>
                    change.type === "position" &&
                    !!change.position &&
                    change.id !== START_KEY &&
                    change.dragging !== true
            )
            for (const change of settled)
                commitNodePosition(change.id, change.position!, 450)

            const startChange = changes.find(
                (change): change is Extract<NodeChange, { type: "position" }> =>
                    change.type === "position" &&
                    !!change.position &&
                    change.id === START_KEY &&
                    change.dragging !== true
            )
            if (startChange) commitStartPosition(startChange.position!, 450)
        },
        [commitNodePosition, commitStartPosition]
    )

    // Executor central do histórico — traduz uma HistoryAction em undo/redo replaying os mesmos
    // comandos usados interativamente (por isso nenhum deles registra histórico de novo: history.push
    // é no-op enquanto useFlowHistory está processando undo/redo). Rejeita (lança) só quando o
    // comando de fato falhou no backend — aí useFlowHistory devolve a ação pra pilha de origem, sem
    // mexer na pilha oposta (ver flow-history.ts). resolveNodeId sempre traduz um id histórico pro
    // id vivo atual, mesmo depois de vários ciclos de recriação (ver nodeIdMapRef).
    const applyHistoryAction = useCallback(
        async (action: HistoryAction, direction: HistoryDirection) => {
            switch (action.kind) {
                case "move-node": {
                    const nodeId = resolveNodeId(action.nodeId)
                    commitNodePosition(
                        nodeId,
                        direction === "undo" ? action.from : action.to,
                        0
                    )
                    return
                }
                case "move-start": {
                    commitStartPosition(
                        direction === "undo" ? action.from : action.to,
                        0
                    )
                    return
                }
                case "connect-edge": {
                    const sourceNodeId = resolveNodeId(action.sourceNodeId)
                    const targetNodeId = resolveNodeId(action.targetNodeId)
                    if (direction === "undo") {
                        if (action.previousTargetNodeId)
                            connectNodes(
                                sourceNodeId,
                                action.sourcePort,
                                resolveNodeId(action.previousTargetNodeId)
                            )
                        else disconnectNodes(sourceNodeId, action.sourcePort)
                    } else {
                        connectNodes(sourceNodeId, action.sourcePort, targetNodeId)
                    }
                    return
                }
                case "disconnect-edge": {
                    const sourceNodeId = resolveNodeId(action.sourceNodeId)
                    const targetNodeId = resolveNodeId(action.targetNodeId)
                    if (direction === "undo")
                        connectNodes(sourceNodeId, action.sourcePort, targetNodeId)
                    else disconnectNodes(sourceNodeId, action.sourcePort)
                    return
                }
                case "change-entry": {
                    const from = action.from ? resolveNodeId(action.from) : null
                    const to = action.to ? resolveNodeId(action.to) : null
                    const ok =
                        direction === "undo"
                            ? from
                                ? await setEntry(from)
                                : await clearEntry(to!)
                            : to
                                ? await setEntry(to)
                                : await clearEntry(from!)
                    if (!ok) throw new Error("change-entry failed")
                    return
                }
                case "create-node": {
                    if (direction === "undo") {
                        const nodeId = resolveNodeId(action.nodeId)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteNodeCore(nodeId)
                        if (!ok) throw new Error("undo create-node failed")
                    } else {
                        const created = await createNode(
                            action.type,
                            { id: action.resourceId, label: action.label },
                            action.position
                        ).result
                        if (!created.ok)
                            throw new Error("redo create-node failed")
                        nodeIdMapRef.current.set(action.nodeId, created.nodeId)
                        action.nodeId = created.nodeId
                    }
                    return
                }
                case "create-resource-node": {
                    if (direction === "undo") {
                        const nodeId = resolveNodeId(action.nodeId)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteResourceCore({
                            nodeId,
                            type: action.resourceType,
                            resourceId: action.resourceId,
                        })
                        if (!ok)
                            throw new Error(
                                "undo create-resource-node failed"
                            )
                    } else {
                        const resourceId = await recreateResource(
                            action.resourceType,
                            action.creationDto,
                            flow.companyId
                        )
                        if (!resourceId)
                            throw new Error(
                                "redo create-resource-node failed: resource"
                            )
                        const created = await createNode(
                            action.resourceType,
                            { id: resourceId, label: action.label },
                            action.position
                        ).result
                        if (!created.ok)
                            throw new Error(
                                "redo create-resource-node failed: node"
                            )
                        nodeIdMapRef.current.set(action.nodeId, created.nodeId)
                        action.nodeId = created.nodeId
                        action.resourceId = resourceId
                    }
                    return
                }
                case "delete-node": {
                    if (direction === "undo") {
                        const created = await createNode(
                            action.node.type as CanvasNodeType,
                            {
                                id: action.node.resourceId!,
                                label: action.node.label,
                            },
                            action.node.position
                        ).result
                        if (!created.ok)
                            throw new Error("undo delete-node failed")
                        nodeIdMapRef.current.set(
                            action.node.id,
                            created.nodeId
                        )
                        action.node = { ...action.node, id: created.nodeId }
                        for (const edge of [
                            ...action.incomingEdges,
                            ...action.outgoingEdges,
                        ])
                            connectNodes(
                                resolveNodeId(edge.sourceNodeId),
                                edge.sourcePort,
                                resolveNodeId(edge.targetNodeId)
                            )
                        if (action.wasEntry) {
                            const ok = await setEntry(created.nodeId)
                            if (!ok)
                                throw new Error(
                                    "undo delete-node entry restore failed"
                                )
                        }
                    } else {
                        const nodeId = resolveNodeId(action.node.id)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteNodeCore(nodeId)
                        if (!ok) throw new Error("redo delete-node failed")
                    }
                    return
                }
                case "delete-resource": {
                    if (direction === "undo") {
                        const resourceId = await recreateResource(
                            action.resourceType,
                            action.creationDto,
                            flow.companyId
                        )
                        if (!resourceId)
                            throw new Error(
                                "undo delete-resource failed: resource"
                            )
                        const created = await createNode(
                            action.resourceType,
                            { id: resourceId, label: action.node.label },
                            action.node.position
                        ).result
                        if (!created.ok)
                            throw new Error(
                                "undo delete-resource failed: node"
                            )
                        nodeIdMapRef.current.set(
                            action.node.id,
                            created.nodeId
                        )
                        action.node = {
                            ...action.node,
                            id: created.nodeId,
                            resourceId,
                        }
                        for (const edge of [
                            ...action.incomingEdges,
                            ...action.outgoingEdges,
                        ])
                            connectNodes(
                                resolveNodeId(edge.sourceNodeId),
                                edge.sourcePort,
                                resolveNodeId(edge.targetNodeId)
                            )
                        if (action.wasEntry) {
                            const ok = await setEntry(created.nodeId)
                            if (!ok)
                                throw new Error(
                                    "undo delete-resource entry restore failed"
                                )
                        }
                    } else {
                        const nodeId = resolveNodeId(action.node.id)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteResourceCore({
                            nodeId,
                            type: action.resourceType,
                            resourceId: action.node.resourceId!,
                        })
                        if (!ok)
                            throw new Error("redo delete-resource failed")
                    }
                    return
                }
            }
        },
        [
            resolveNodeId,
            commitNodePosition,
            commitStartPosition,
            connectNodes,
            disconnectNodes,
            setEntry,
            clearEntry,
            removeNodeFromCanvas,
            deleteNodeCore,
            deleteResourceCore,
            createNode,
            recreateResource,
            flow.companyId,
        ]
    )

    useEffect(() => {
        history.setApplyAction(applyHistoryAction)
    }, [applyHistoryAction, history])

    // Atalhos de undo/redo — só quando o foco está no canvas (ou em lugar nenhum, caso comum logo
    // após abrir a página e nunca ter clicado num input). Diálogos (base-ui) fazem portal fora da
    // subárvore de canvasRootRef, então o teste de containment já basta pra nunca disparar com um
    // diálogo aberto; o teste de input/textarea/contentEditable é defesa extra caso um campo de
    // texto passe a existir dentro do canvas no futuro. preventDefault só roda depois dos guards,
    // então o desfazer nativo de texto (em qualquer lugar fora do canvas) nunca é tocado.
    useEffect(() => {
        function isEditableTarget(target: EventTarget | null) {
            if (!(target instanceof HTMLElement)) return false
            if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
                return true
            return target.isContentEditable
        }
        function onKeyDown(event: KeyboardEvent) {
            const key = event.key.toLowerCase()
            const isMod = event.ctrlKey || event.metaKey
            if (!isMod || (key !== "z" && key !== "y")) return
            const withinCanvas =
                canvasRootRef.current?.contains(event.target as Node) ?? false
            const noFocusElsewhere =
                document.activeElement === document.body ||
                document.activeElement === null
            if (!withinCanvas && !noFocusElsewhere) return
            if (isEditableTarget(event.target)) return
            if (key === "z" && event.shiftKey) {
                event.preventDefault()
                history.redo()
            } else if (key === "z") {
                event.preventDefault()
                history.undo()
            } else if (key === "y") {
                event.preventDefault()
                history.redo()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [history])

    useEffect(() => {
        if (!flow.id || loading) return
        if (hydratedFlowRef.current === flow.id) return
        hydratedFlowRef.current = flow.id
        let cancelled = false
        const knownNodeIds = new Set([
            START_KEY,
            ...flowNodes.map((node) => node.id),
        ])
        void loadPendingForFlow(flow.id).then(({ positions, edgeOps }) => {
            if (cancelled) return
            let hasPositions = false
            for (const [nodeId, position] of positions) {
                if (!knownNodeIds.has(nodeId)) {
                    void clearPendingPosition(flow.id, nodeId)
                    continue
                }
                pendingPositions.current.set(nodeId, position)
                hasPositions = true
            }
            if (hasPositions) {
                setFlowNodes((current) =>
                    current.map((node) =>
                        pendingPositions.current.has(node.id)
                            ? {
                                ...node,
                                position: pendingPositions.current.get(
                                    node.id
                                )!,
                            }
                            : node
                    )
                )
                if (saveTimer.current) clearTimeout(saveTimer.current)
                saveTimer.current = setTimeout(() => void persistPositions(), 0)
            }

            let hasEdgeOps = false
            for (const [key, operation] of edgeOps) {
                const sourceKnown = knownNodeIds.has(operation.sourceNodeId)
                const targetKnown =
                    operation.type === "disconnect" ||
                    knownNodeIds.has(operation.targetNodeId)
                if (!sourceKnown || !targetKnown) {
                    void clearPendingEdgeOp(flow.id, key)
                    continue
                }
                pendingEdgeOperations.current.set(key, operation)
                hasEdgeOps = true
            }
            if (hasEdgeOps) {
                setFlowEdges((current) =>
                    applyEdgeOperations(
                        current,
                        pendingEdgeOperations.current.values()
                    )
                )
                scheduleEdgeSync(0)
            }
        })
        return () => {
            cancelled = true
        }
    }, [
        flow.id,
        loading,
        flowNodes,
        persistPositions,
        scheduleEdgeSync,
        setFlowEdges,
        setFlowNodes,
    ])

    const onConnect = useCallback(
        async ({ source, sourceHandle, target }: Connection) => {
            if (!source || !sourceHandle || !target) return
            if (source === START_KEY) await setEntry(target)
            else await connectNodes(source, sourceHandle, target)
        },
        [connectNodes, setEntry]
    )

    const onEdgesDelete = useCallback(
        (edges: Edge[]) => {
            for (const edge of edges)
                if (edge.id === `start-${entryNodeId}` && entryNodeId)
                    void clearEntry(entryNodeId)
                else void deleteEdge(edge.id)
        },
        [clearEntry, deleteEdge, entryNodeId]
    )

    function addConfiguredNode(
        type: CanvasNodeType,
        option: DestinationOption
    ) {
        const fallback = {
            x: 100 + (flowNodes.length % 4) * 240,
            y: 120 + Math.floor(flowNodes.length / 4) * 150,
        }
        const { localId } = createNode(type, option, fallback)
        history.push({
            kind: "create-node",
            nodeId: localId,
            type,
            resourceId: option.id,
            label: option.label ?? null,
            position: fallback,
        })
    }

    return (
        <>
            <div ref={canvasRootRef} className="relative h-full w-full bg-background">
                {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" />
                        Carregando...
                    </div>
                ) : (
                    <ContextMenu>
                        <ContextMenuTrigger className="block h-full w-full">
                            <ReactFlow
                                nodes={rfNodes}
                                edges={rfEdges}
                                nodeTypes={NODE_TYPES}
                                edgeTypes={EDGE_TYPES}
                                onNodesChange={onNodesChange}
                                onConnect={onConnect}
                                onEdgesDelete={onEdgesDelete}
                                onMoveStart={showMiniMap}
                                onMoveEnd={scheduleMiniMapHide}
                                onNodeDragStart={showMiniMap}
                                onNodeDragStop={scheduleMiniMapHide}
                                fitView
                                fitViewOptions={{ padding: 0.28 }}
                                minZoom={0.35}
                                maxZoom={1.6}
                            >
                                <Background
                                    gap={28}
                                    size={2}
                                />
                                <Controls />
                                <MiniMap
                                    pannable
                                    zoomable
                                    className={
                                        isMiniMapVisible
                                            ? "opacity-100 transition-opacity duration-200"
                                            : "pointer-events-none opacity-0 transition-opacity duration-200"
                                    }
                                />
                            </ReactFlow>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                            <ContextMenuGroup>
                                <ContextMenuLabel>Adicionar ação</ContextMenuLabel>
                                <ContextMenuSeparator />
                                {NODE_ACTIONS.map((action) => {
                                    const Icon =
                                        ROUTE_DEST_ICONS[action.resourceTypes[0]]
                                    return (
                                        <ContextMenuItem
                                            key={action.id}
                                            onClick={() =>
                                                setPendingAction(action.id)
                                            }
                                        >
                                            <Icon className="size-3.5" />
                                            {action.label}
                                        </ContextMenuItem>
                                    )
                                })}
                            </ContextMenuGroup>
                        </ContextMenuContent>
                    </ContextMenu>
                )}
                {(refreshing || isSyncingEdges) && (
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                        <Loader2Icon className="size-3 animate-spin" />
                        {isSyncingEdges ? "Salvando conexões..." : "Sincronizando..."}
                    </div>
                )}
            </div>
            <NodeActionDialog
                action={pendingAction}
                companyId={flow.companyId}
                open={pendingAction !== null}
                onOpenChange={(open) => !open && setPendingAction(null)}
                onSelect={addConfiguredNode}
                onCreate={(type) => {
                    setPendingAction(null)
                    setPendingCreation({ type })
                }}
            />
            {pendingCreation && (
                <CreateNodeDialog
                    key={`${pendingCreation.type}:${pendingCreation.source?.nodeId ?? "canvas"}:${pendingCreation.source?.port ?? ""}`}
                    type={pendingCreation.type}
                    open
                    onOpenChange={(open) => !open && setPendingCreation(null)}
                    companyId={flow.companyId}
                    companies={companies.filter(
                        (company) => company.id === flow.companyId
                    )}
                    onCreated={async (option, creationDto) => {
                        const source = pendingCreation.source
                            ? nodeById.get(pendingCreation.source.nodeId)
                            : null
                        const position = source
                            ? {
                                x: source.position.x + 280,
                                y: source.position.y + 70,
                            }
                            : {
                                x: 100 + (flowNodes.length % 4) * 240,
                                y:
                                    120 +
                                    Math.floor(flowNodes.length / 4) * 150,
                            }
                        const { localId } = createNode(
                            pendingCreation.type,
                            option,
                            position
                        )
                        history.push({
                            kind: "create-resource-node",
                            nodeId: localId,
                            resourceType: pendingCreation.type,
                            resourceId: option.id,
                            label: option.label ?? null,
                            position,
                            creationDto,
                        })
                        if (pendingCreation.source)
                            connectNodes(
                                pendingCreation.source.nodeId,
                                pendingCreation.source.port,
                                localId
                            )
                    }}
                />
            )}
            {editingNode && (
                <EditNodeDialog
                    key={`${editingNode.type}:${editingNode.resourceId}`}
                    type={editingNode.type}
                    id={editingNode.resourceId}
                    open
                    onOpenChange={(open) => !open && setEditingNode(null)}
                    companyId={flow.companyId}
                    companies={companies.filter(
                        (company) => company.id === flow.companyId
                    )}
                    onSaved={() => void refetchNodes()}
                    onDeleteResource={(creationDto) =>
                        setResourceToDelete({
                            nodeId: editingNode.nodeId,
                            type: editingNode.type,
                            resourceId: editingNode.resourceId,
                            name: editingNode.name,
                            creationDto,
                        })
                    }
                />
            )}
            <ConfirmDeleteDialog
                open={!!resourceToDelete}
                onOpenChange={(open) => !open && setResourceToDelete(null)}
                title="Excluir recurso e nó"
                itemName={resourceToDelete?.name}
                onConfirm={deleteResource}
            />
        </>
    )
}

export function FlowCanvas(props: Props) {
    return (
        <ReactFlowProvider>
            <FlowCanvasInner {...props} />
        </ReactFlowProvider>
    )
}
