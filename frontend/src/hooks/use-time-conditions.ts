"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type TimeCondition = {
    id: string
    name: string
    companyId: string
    // não são mais editáveis por aqui - só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantidos no tipo só porque a
    // API ainda devolve os campos (label resolvido, usado em telas de leitura)
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    usedBy: UsedByRef[]
    timeGroups: { timeGroup: { id: string; name: string } }[]
    createdAt: string
    updatedAt: string
}

// Espelha create/updateTimeConditionSchema de backend/src/modules/time-conditions/schemas/time-condition.schema.ts
// (sem trueRoute/falseRoute - ver comentário no tipo TimeCondition acima) - companyId/groupIds só
// existem no create, o PUT do backend não permite trocar empresa nem os grupos vinculados
export const createTimeConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    groupIds: z
        .array(z.string())
        .min(1, "Selecione ao menos um grupo de horário"),
})

export const updateTimeConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
})

export type TimeConditionForm = z.infer<typeof createTimeConditionFormSchema>
export type TimeConditionUpdateForm = z.infer<
    typeof updateTimeConditionFormSchema
>

// DTO de criação a partir do registro salvo (sem companyId - recriação sempre usa a empresa do
// flow). Diferente de TimeConditionUpdateForm (só "name", já que o PUT não permite trocar grupos):
// aqui precisamos de groupIds também, pois recriar o recurso do zero exige os grupos vinculados.
// Usado pelo histórico de undo/redo do Flow pra recriar o recurso quando o usuário desfaz uma
// exclusão (ver flow-canvas.tsx).
export type TimeConditionCreationDto = Omit<TimeConditionForm, "companyId">

export function toTimeConditionCreationDto(
    timeCondition: TimeCondition
): TimeConditionCreationDto {
    return {
        name: timeCondition.name,
        groupIds: timeCondition.timeGroups.map((g) => g.timeGroup.id),
    }
}

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
async function fetchTimeConditionsRequest(
    companyId: string
): Promise<TimeCondition[]> {
    const { data } = await api.get("/time-conditions", { params: { companyId } })
    return data.timeConditions ?? []
}

export function useTimeConditions(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: timeConditions = [], isLoading: loading } = useQuery({
        queryKey: ["time-conditions", companyId],
        queryFn: () => fetchTimeConditionsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["time-conditions"] })

    const createMutation = useMutation({
        mutationFn: (form: TimeConditionForm) =>
            api.post("/time-conditions", form),
    })

    // companyId da condição vem do próprio form (campo "Empresa" do dialog), não do filtro da página -
    // permite criar uma condição pra empresa X enquanto a tabela lista a empresa Y
    async function createTimeCondition(
        form: TimeConditionForm
    ): Promise<boolean>
    async function createTimeCondition(
        form: TimeConditionForm,
        withResourceId: true
    ): Promise<string | null>
    async function createTimeCondition(
        form: TimeConditionForm,
        withResourceId = false
    ) {
        const id = toast.loading("Criando condição de horário...")
        try {
            const { data } = await createMutation.mutateAsync(form)
            toast.success("Condição de horário criada", { id })
            await invalidate()
            return withResourceId ? (data.timeConditionId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar condição de horário"), {
                id,
            })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            timeConditionId,
            form,
        }: {
            timeConditionId: string
            form: TimeConditionUpdateForm
        }) => api.put(`/time-conditions/${timeConditionId}`, form),
    })

    const updateTimeCondition = async (
        timeConditionId: string,
        form: TimeConditionUpdateForm
    ) => {
        const id = toast.loading("Atualizando condição de horário...")
        try {
            await updateMutation.mutateAsync({ timeConditionId, form })
            toast.success("Condição de horário atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(
                apiError(err, "Erro ao atualizar condição de horário"),
                { id }
            )
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (timeConditionId: string) =>
            api.delete(`/time-conditions/${timeConditionId}`),
    })

    const deleteTimeCondition = async (timeConditionId: string) => {
        const id = toast.loading("Deletando condição de horário...")
        try {
            await deleteMutation.mutateAsync(timeConditionId)
            toast.success("Condição de horário deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar condição de horário"), {
                id,
            })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            timeConditions.filter((tc) =>
                tc.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [timeConditions, filter]
    )

    return {
        timeConditions: filtered,
        loading,
        filter,
        setFilter,
        fetchTimeConditions: invalidate,
        createTimeCondition,
        updateTimeCondition,
        deleteTimeCondition,
    }
}
