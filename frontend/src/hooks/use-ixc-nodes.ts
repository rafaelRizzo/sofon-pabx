"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export const IXC_NODE_ACTIONS = ["listar_cliente", "listar_boleto", "listar_contrato"] as const
export type IxcNodeAction = (typeof IXC_NODE_ACTIONS)[number]

export const IXC_NODE_ACTION_LABELS: Record<IxcNodeAction, string> = {
    listar_cliente: "Listar cliente",
    listar_boleto: "Listar boleto",
    listar_contrato: "Listar contrato",
}

export type IxcVariableMapping = { path: string; variable: string }

export type IxcTestResult = {
    url: string
    payload: Record<string, string>
    status: number
    ok: boolean
    data: unknown
    rawBody: string
}

export type IxcTestPayload = {
    companyId: string
    credentialId: string
    action: IxcNodeAction
    params: Record<string, string>
}

export type IxcNode = {
    id: string
    name: string
    companyId: string
    credentialId: string
    action: IxcNodeAction
    params: Record<string, string>
    timeoutMs: number
    variableMappings: IxcVariableMapping[]
    // não são mais editáveis por aqui - só via arrastar uma conexão no canvas do Flow (mesmo
    // padrão de RequestTemplate, ver use-request-templates.ts)
    onSuccess: RouteDestination
    onError: RouteDestination
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

const optNumberRange = (min: number, max: number) =>
    z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

const paramFieldSchema = z.object({
    key: z.string().min(1, "Informe a chave").max(200, "Máximo 200 caracteres"),
    value: z.string().min(1, "Informe o valor").max(2000, "Máximo 2000 caracteres"),
})

// Espelha variableMappingSchema de backend/src/modules/ixc-nodes/schemas/ixc-node.schema.ts
const variableMappingFieldSchema = z.object({
    path: z.string().min(1, "Informe o caminho").max(200, "Máximo 200 caracteres"),
    variable: z
        .string()
        .min(1, "Informe a variável")
        .max(80, "Máximo 80 caracteres")
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letras, dígitos e _ (começando com letra ou _)"),
})

// Espelha create/updateIxcNodeSchema de backend/src/modules/ixc-nodes/schemas/ixc-node.schema.ts
export const createIxcNodeFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    credentialId: z.string().min(1, "Selecione uma credencial"),
    action: z.enum(IXC_NODE_ACTIONS),
    timeoutMs: optNumberRange(500, 30000),
    params: z.array(paramFieldSchema),
    variableMappings: z.array(variableMappingFieldSchema).max(20, "Máximo 20 mapeamentos"),
})

export const updateIxcNodeFormSchema = createIxcNodeFormSchema.omit({ companyId: true })

export type IxcNodeForm = z.infer<typeof createIxcNodeFormSchema>
export type IxcNodeUpdateForm = z.infer<typeof updateIxcNodeFormSchema>

// DTO de criação a partir do registro salvo - usado pelo histórico de undo/redo do Flow (mesmo
// padrão de toRequestTemplateCreationDto, ver flow-canvas.tsx)
export function toIxcNodeCreationDto(ixcNode: IxcNode): IxcNodeUpdateForm {
    return {
        name: ixcNode.name,
        credentialId: ixcNode.credentialId,
        action: ixcNode.action,
        timeoutMs: ixcNode.timeoutMs,
        params: Object.entries(ixcNode.params ?? {}).map(([key, value]) => ({ key, value })),
        variableMappings: ixcNode.variableMappings,
    }
}

function toPayload(form: IxcNodeUpdateForm) {
    return {
        name: form.name,
        credentialId: form.credentialId,
        action: form.action,
        timeoutMs: form.timeoutMs,
        params: Object.fromEntries(form.params.map((p) => [p.key, p.value])),
        variableMappings: form.variableMappings,
    }
}

async function fetchIxcNodesRequest(companyId: string): Promise<IxcNode[]> {
    const { data } = await api.get("/ixc-nodes", { params: { companyId } })
    return data.ixcNodes ?? []
}

export function useIxcNodes(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: ixcNodes = [], isLoading: loading } = useQuery({
        queryKey: ["ixc-nodes", companyId],
        queryFn: () => fetchIxcNodesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ixc-nodes"] })

    const createMutation = useMutation({
        mutationFn: ({ form, targetCompanyId }: { form: IxcNodeForm; targetCompanyId: string }) =>
            api.post("/ixc-nodes", { ...toPayload(form), companyId: targetCompanyId }),
    })

    async function createIxcNode(form: IxcNodeForm, targetCompanyId: string): Promise<boolean>
    async function createIxcNode(form: IxcNodeForm, targetCompanyId: string, withResourceId: true): Promise<string | null>
    async function createIxcNode(form: IxcNodeForm, targetCompanyId: string, withResourceId = false) {
        const id = toast.loading("Criando nó IXCsoft...")
        try {
            const { data } = await createMutation.mutateAsync({ form, targetCompanyId })
            toast.success("Nó IXCsoft criado", { id })
            await invalidate()
            return withResourceId ? (data.ixcNodeId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar nó IXCsoft"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({ ixcNodeId, form }: { ixcNodeId: string; form: IxcNodeUpdateForm }) =>
            api.put(`/ixc-nodes/${ixcNodeId}`, toPayload(form)),
    })

    const updateIxcNode = async (ixcNodeId: string, form: IxcNodeUpdateForm) => {
        const id = toast.loading("Atualizando nó IXCsoft...")
        try {
            await updateMutation.mutateAsync({ ixcNodeId, form })
            toast.success("Nó IXCsoft atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar nó IXCsoft"), { id })
            return false
        }
    }

    const testMutation = useMutation({
        mutationFn: (payload: IxcTestPayload) => api.post("/ixc-nodes/test", payload),
    })

    const testIxcNode = async (payload: IxcTestPayload): Promise<IxcTestResult | null> => {
        try {
            const { data } = await testMutation.mutateAsync(payload)
            return data.result as IxcTestResult
        } catch (err) {
            toast.error(apiError(err, "Erro ao testar requisição IXCsoft"))
            return null
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (ixcNodeId: string) => api.delete(`/ixc-nodes/${ixcNodeId}`),
    })

    const deleteIxcNode = async (ixcNodeId: string) => {
        const id = toast.loading("Deletando nó IXCsoft...")
        try {
            await deleteMutation.mutateAsync(ixcNodeId)
            toast.success("Nó IXCsoft deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar nó IXCsoft"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () => ixcNodes.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase())),
        [ixcNodes, filter]
    )

    return {
        ixcNodes: filtered,
        loading,
        filter,
        setFilter,
        fetchIxcNodes: invalidate,
        createIxcNode,
        updateIxcNode,
        deleteIxcNode,
        testIxcNode,
        testing: testMutation.isPending,
    }
}
