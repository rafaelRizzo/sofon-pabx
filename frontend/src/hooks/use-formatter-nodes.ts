"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type FormatterNode = {
    id: string
    name: string
    companyId: string
    inputVariable: string
    outputVariable: string
    masks: string[]
    // não são mais editáveis por aqui - só via arrastar uma conexão no canvas do Flow (mesmo
    // padrão de RequestTemplate, ver use-request-templates.ts)
    onSuccess: RouteDestination
    onError: RouteDestination
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

// Espelha maskSchema de backend/src/modules/formatter-nodes/schemas/formatter-node.schema.ts
const maskFieldSchema = z
    .string()
    .min(1, "Informe a máscara")
    .max(60, "Máximo 60 caracteres")
    .refine((m) => /[0A*]/.test(m), "A máscara precisa ter ao menos um token 0, A ou *")

// Espelha create/updateFormatterNodeSchema de
// backend/src/modules/formatter-nodes/schemas/formatter-node.schema.ts
export const createFormatterNodeFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    inputVariable: z.string().min(1, "Informe a variável de entrada").max(120, "Máximo 120 caracteres"),
    outputVariable: z
        .string()
        .min(1, "Informe a variável de saída")
        .max(80, "Máximo 80 caracteres")
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letras, dígitos e _ (começando com letra ou _)"),
    masks: z.array(maskFieldSchema).min(1, "Informe ao menos uma máscara").max(10, "Máximo 10 máscaras"),
})

export const updateFormatterNodeFormSchema = createFormatterNodeFormSchema.omit({ companyId: true })

export type FormatterNodeForm = z.infer<typeof createFormatterNodeFormSchema>
export type FormatterNodeUpdateForm = z.infer<typeof updateFormatterNodeFormSchema>

// DTO de criação a partir do registro salvo - usado pelo histórico de undo/redo do Flow (mesmo
// padrão de toIxcNodeCreationDto, ver flow-canvas.tsx)
export function toFormatterNodeCreationDto(formatterNode: FormatterNode): FormatterNodeUpdateForm {
    return {
        name: formatterNode.name,
        inputVariable: formatterNode.inputVariable,
        outputVariable: formatterNode.outputVariable,
        masks: formatterNode.masks,
    }
}

function toPayload(form: FormatterNodeUpdateForm) {
    return {
        name: form.name,
        inputVariable: form.inputVariable,
        outputVariable: form.outputVariable,
        masks: form.masks,
    }
}

async function fetchFormatterNodesRequest(companyId: string): Promise<FormatterNode[]> {
    const { data } = await api.get("/formatter-nodes", { params: { companyId } })
    return data.formatterNodes ?? []
}

export function useFormatterNodes(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: formatterNodes = [], isLoading: loading } = useQuery({
        queryKey: ["formatter-nodes", companyId],
        queryFn: () => fetchFormatterNodesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["formatter-nodes"] })

    const createMutation = useMutation({
        mutationFn: ({ form, targetCompanyId }: { form: FormatterNodeForm; targetCompanyId: string }) =>
            api.post("/formatter-nodes", { ...toPayload(form), companyId: targetCompanyId }),
    })

    async function createFormatterNode(form: FormatterNodeForm, targetCompanyId: string): Promise<boolean>
    async function createFormatterNode(form: FormatterNodeForm, targetCompanyId: string, withResourceId: true): Promise<string | null>
    async function createFormatterNode(form: FormatterNodeForm, targetCompanyId: string, withResourceId = false) {
        const id = toast.loading("Criando nó Formatter...")
        try {
            const { data } = await createMutation.mutateAsync({ form, targetCompanyId })
            toast.success("Nó Formatter criado", { id })
            await invalidate()
            return withResourceId ? (data.formatterNodeId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar nó Formatter"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({ formatterNodeId, form }: { formatterNodeId: string; form: FormatterNodeUpdateForm }) =>
            api.put(`/formatter-nodes/${formatterNodeId}`, toPayload(form)),
    })

    const updateFormatterNode = async (formatterNodeId: string, form: FormatterNodeUpdateForm) => {
        const id = toast.loading("Atualizando nó Formatter...")
        try {
            await updateMutation.mutateAsync({ formatterNodeId, form })
            toast.success("Nó Formatter atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar nó Formatter"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (formatterNodeId: string) => api.delete(`/formatter-nodes/${formatterNodeId}`),
    })

    const deleteFormatterNode = async (formatterNodeId: string) => {
        const id = toast.loading("Deletando nó Formatter...")
        try {
            await deleteMutation.mutateAsync(formatterNodeId)
            toast.success("Nó Formatter deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar nó Formatter"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () => formatterNodes.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase())),
        [formatterNodes, filter]
    )

    return {
        formatterNodes: filtered,
        loading,
        filter,
        setFilter,
        fetchFormatterNodes: invalidate,
        createFormatterNode,
        updateFormatterNode,
        deleteFormatterNode,
    }
}
