"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type Variable = {
    id: string
    name: string
    companyId: string
    description: string | null
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

// Espelha create/updateVariableSchema de backend/src/modules/variable-catalog/schemas/variable-catalog.schema.ts
export const createVariableFormSchema = z.object({
    name: z
        .string()
        .min(1, "Informe o nome")
        .max(80, "Máximo 80 caracteres")
        .regex(
            /^[A-Za-z_][A-Za-z0-9_]*$/,
            "Use letras, dígitos e _ (começando com letra ou _)"
        ),
    companyId: z.string().min(1, "Selecione uma empresa"),
    description: z.string().max(200, "Máximo 200 caracteres").optional(),
})

export const updateVariableFormSchema = createVariableFormSchema.omit({
    companyId: true,
})

export type VariableForm = z.infer<typeof createVariableFormSchema>
export type VariableUpdateForm = z.infer<typeof updateVariableFormSchema>

// companyId opcional - enquanto não informado, a lista não é buscada (mesmo padrão de
// use-time-groups.ts)
async function fetchVariablesRequest(companyId: string): Promise<Variable[]> {
    const { data } = await api.get("/variable-catalog", { params: { companyId } })
    return data.variables ?? []
}

export function useVariableCatalog(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: variables = [], isLoading: loading } = useQuery({
        queryKey: ["variable-catalog", companyId],
        queryFn: () => fetchVariablesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["variable-catalog"] })

    const createMutation = useMutation({
        mutationFn: (form: VariableForm) => api.post("/variable-catalog", form),
    })

    const createVariable = async (form: VariableForm) => {
        const id = toast.loading("Criando variável...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Variável criada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar variável"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            variableId,
            form,
        }: {
            variableId: string
            form: VariableUpdateForm
        }) => api.put(`/variable-catalog/${variableId}`, form),
    })

    const updateVariable = async (variableId: string, form: VariableUpdateForm) => {
        const id = toast.loading("Atualizando variável...")
        try {
            await updateMutation.mutateAsync({ variableId, form })
            toast.success("Variável atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar variável"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (variableId: string) => api.delete(`/variable-catalog/${variableId}`),
    })

    const deleteVariable = async (variableId: string) => {
        const id = toast.loading("Deletando variável...")
        try {
            await deleteMutation.mutateAsync(variableId)
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
            variables.filter((v) =>
                `${v.name} ${v.description ?? ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            ),
        [variables, filter]
    )

    return {
        variables: filtered,
        loading,
        filter,
        setFilter,
        fetchVariables: invalidate,
        createVariable,
        updateVariable,
        deleteVariable,
    }
}
