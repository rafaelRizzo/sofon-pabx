"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { routeDestinationSchema, type RouteDestination } from "@/components/RouteDestination/route-destination-field"

export type TimeCondition = {
    id: string
    name: string
    companyId: string
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    timeGroups: { timeGroup: { id: string; name: string } }[]
    createdAt: string
    updatedAt: string
}

// Espelha create/updateTimeConditionSchema de backend/src/modules/time-conditions/schemas/time-condition.schema.ts —
// companyId/groupIds só existem no create, o PUT do backend não permite trocar empresa nem os grupos vinculados
export const createTimeConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    groupIds: z.array(z.string()).min(1, "Selecione ao menos um grupo de horário"),
    trueRoute: routeDestinationSchema,
    falseRoute: routeDestinationSchema,
})

export const updateTimeConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    trueRoute: routeDestinationSchema,
    falseRoute: routeDestinationSchema,
})

export type TimeConditionForm = z.infer<typeof createTimeConditionFormSchema>
export type TimeConditionUpdateForm = z.infer<typeof updateTimeConditionFormSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useTimeConditions(companyId?: string) {
    const [timeConditions, setTimeConditions] = useState<TimeCondition[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchTimeConditions = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/time-conditions", {
                params: companyId ? { companyId } : undefined,
            })
            setTimeConditions(data.timeConditions ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar condições de horário"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId da condição vem do próprio form (campo "Empresa" do dialog), não do filtro da página —
    // permite criar uma condição pra empresa X enquanto a tabela lista a empresa Y
    const createTimeCondition = async (form: TimeConditionForm) => {
        const id = toast.loading("Criando condição de horário...")
        try {
            await api.post("/time-conditions", form)
            toast.success("Condição de horário criada", { id })
            await fetchTimeConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar condição de horário"), { id })
            return false
        }
    }

    const updateTimeCondition = async (timeConditionId: string, form: TimeConditionUpdateForm) => {
        const id = toast.loading("Atualizando condição de horário...")
        try {
            await api.put(`/time-conditions/${timeConditionId}`, form)
            toast.success("Condição de horário atualizada", { id })
            await fetchTimeConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar condição de horário"), { id })
            return false
        }
    }

    const deleteTimeCondition = async (timeConditionId: string) => {
        const id = toast.loading("Deletando condição de horário...")
        try {
            await api.delete(`/time-conditions/${timeConditionId}`)
            toast.success("Condição de horário deletada", { id })
            await fetchTimeConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar condição de horário"), { id })
            return false
        }
    }

    const filtered = timeConditions.filter((tc) =>
        tc.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (!companyId) {
            setTimeConditions([])
            setLoading(false)
            fetchStateRef.current = { fetched: false }
            return
        }
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchTimeConditions()
    }, [fetchTimeConditions, companyId])

    return {
        timeConditions: filtered,
        loading,
        filter,
        setFilter,
        fetchTimeConditions,
        createTimeCondition,
        updateTimeCondition,
        deleteTimeCondition,
    }
}
