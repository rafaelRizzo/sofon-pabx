"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type Assignment = { variable: string; value: string }

export type VariableSet = {
    id: string
    name: string
    companyId: string
    assignments: Assignment[]
    // não é mais editável por aqui — só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantido no tipo só porque a
    // API ainda devolve o campo (label resolvido, usado em telas de leitura)
    destination: RouteDestination
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

// Espelha assignmentSchema de backend/src/modules/variables/schemas/variable.schema.ts
const assignmentFieldSchema = z.object({
    variable: z
        .string()
        .min(1, "Informe a variável")
        .max(80, "Máximo 80 caracteres")
        .regex(
            /^[A-Za-z_][A-Za-z0-9_]*$/,
            "Use letras, dígitos e _ (começando com letra ou _)"
        ),
    value: z
        .string()
        .max(500, "Máximo 500 caracteres")
        .regex(/^[^"\\]*$/, "Não pode conter aspas duplas ou barra invertida"),
})

// Espelha create/updateVariableSetSchema de backend/src/modules/variables/schemas/variable.schema.ts —
// companyId só existe no create, o PATCH do backend não permite trocar empresa
export const createVariableSetFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    assignments: z
        .array(assignmentFieldSchema)
        .min(1, "Adicione ao menos uma atribuição")
        .max(20, "Máximo 20 atribuições"),
})

export const updateVariableSetFormSchema = createVariableSetFormSchema.omit({
    companyId: true,
})

export type VariableSetForm = z.infer<typeof createVariableSetFormSchema>
export type VariableSetUpdateForm = z.infer<typeof updateVariableSetFormSchema>

// DTO de criação a partir do registro salvo (sem companyId — recriação sempre usa a empresa do
// flow) — usado pelo histórico de undo/redo do Flow pra recriar o recurso quando o usuário desfaz
// uma exclusão (ver flow-canvas.tsx)
export function toVariableSetCreationDto(
    variableSet: VariableSet
): VariableSetUpdateForm {
    return { name: variableSet.name, assignments: variableSet.assignments }
}

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
async function fetchVariableSetsRequest(
    companyId: string
): Promise<VariableSet[]> {
    const { data } = await api.get("/variables", { params: { companyId } })
    return data.variableSets ?? []
}

export function useVariables(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: variableSets = [], isLoading: loading } = useQuery({
        queryKey: ["variables", companyId],
        queryFn: () => fetchVariableSetsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["variables"] })

    const createMutation = useMutation({
        mutationFn: (form: VariableSetForm) => api.post("/variables", form),
    })

    // companyId da variável vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    async function createVariableSet(form: VariableSetForm): Promise<boolean>
    async function createVariableSet(
        form: VariableSetForm,
        withResourceId: true
    ): Promise<string | null>
    async function createVariableSet(
        form: VariableSetForm,
        withResourceId = false
    ) {
        const id = toast.loading("Criando variável...")
        try {
            const { data } = await createMutation.mutateAsync(form)
            toast.success("Variável criada", { id })
            await invalidate()
            return withResourceId ? (data.variableSetId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar variável"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            variableSetId,
            form,
        }: {
            variableSetId: string
            form: VariableSetUpdateForm
        }) => api.patch(`/variables/${variableSetId}`, form),
    })

    const updateVariableSet = async (
        variableSetId: string,
        form: VariableSetUpdateForm
    ) => {
        const id = toast.loading("Atualizando variável...")
        try {
            await updateMutation.mutateAsync({ variableSetId, form })
            toast.success("Variável atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar variável"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (variableSetId: string) =>
            api.delete(`/variables/${variableSetId}`),
    })

    const deleteVariableSet = async (variableSetId: string) => {
        const id = toast.loading("Deletando variável...")
        try {
            await deleteMutation.mutateAsync(variableSetId)
            toast.success("Variável deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar variável"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            variableSets.filter((v) =>
                v.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [variableSets, filter]
    )

    return {
        variableSets: filtered,
        loading,
        filter,
        setFilter,
        fetchVariableSets: invalidate,
        createVariableSet,
        updateVariableSet,
        deleteVariableSet,
    }
}
