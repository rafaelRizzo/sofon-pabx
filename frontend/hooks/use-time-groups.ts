"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export const WEEKDAYS = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type TimeRange = {
    id: string
    startTime: string
    endTime: string
    weekdays: Weekday[]
    monthdays: string
    months: string
    createdAt: string
}

export type TimeGroup = {
    id: string
    name: string
    companyId: string
    ranges: TimeRange[]
    createdAt: string
    updatedAt: string
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
const monthdaysRegex = /^(\*|([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01]))?)$/
const monthsRegex =
    /^(\*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(-[a-z]{3})?)$/

// Espelha timeRangeSchema de backend/src/modules/time-groups/schemas/time-group.schema.ts
const timeRangeFormSchema = z.object({
    startTime: z.string().regex(timeRegex, "Horário inválido (HH:MM)"),
    endTime: z.string().regex(timeRegex, "Horário inválido (HH:MM)"),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1, "Selecione ao menos um dia"),
    monthdays: z
        .string()
        .regex(monthdaysRegex, "Formato inválido (ex: *, 1, 1-15)")
        .default("*"),
    months: z
        .string()
        .regex(monthsRegex, "Formato inválido (ex: *, jan, jan-jun)")
        .default("*"),
})

// companyId só existe no create — o PUT do backend não permite trocar a empresa de um grupo existente
export const createTimeGroupFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    ranges: z
        .array(timeRangeFormSchema)
        .min(1, "Adicione ao menos um período")
        .max(20, "Máximo 20 períodos"),
})

export const updateTimeGroupFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    ranges: z
        .array(timeRangeFormSchema)
        .min(1, "Adicione ao menos um período")
        .max(20, "Máximo 20 períodos"),
})

export type TimeGroupForm = z.infer<typeof createTimeGroupFormSchema>
export type TimeGroupUpdateForm = z.infer<typeof updateTimeGroupFormSchema>
export type TimeRangeForm = z.infer<typeof timeRangeFormSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useTimeGroups(companyId?: string) {
    const [timeGroups, setTimeGroups] = useState<TimeGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchTimeGroups = useCallback(async () => {
        if (!companyId) {
            setTimeGroups([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/time-groups", {
                params: { companyId },
            })
            setTimeGroups(data.timeGroups ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar grupos de horário"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId do grupo vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    const createTimeGroup = async (form: TimeGroupForm) => {
        const id = toast.loading("Criando grupo de horário...")
        try {
            await api.post("/time-groups", form)
            toast.success("Grupo de horário criado", { id })
            await fetchTimeGroups()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar grupo de horário"), { id })
            return false
        }
    }

    const updateTimeGroup = async (
        timeGroupId: string,
        form: TimeGroupUpdateForm
    ) => {
        const id = toast.loading("Atualizando grupo de horário...")
        try {
            await api.put(`/time-groups/${timeGroupId}`, form)
            toast.success("Grupo de horário atualizado", { id })
            await fetchTimeGroups()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar grupo de horário"), {
                id,
            })
            return false
        }
    }

    const deleteTimeGroup = async (timeGroupId: string) => {
        const id = toast.loading("Deletando grupo de horário...")
        try {
            await api.delete(`/time-groups/${timeGroupId}`)
            toast.success("Grupo de horário deletado", { id })
            await fetchTimeGroups()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar grupo de horário"), {
                id,
            })
            return false
        }
    }

    const filtered = timeGroups.filter((g) =>
        g.name.toLowerCase().includes(filter.toLowerCase())
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
        fetchTimeGroups()
    }, [fetchTimeGroups, companyId])

    return {
        timeGroups: filtered,
        loading,
        filter,
        setFilter,
        fetchTimeGroups,
        createTimeGroup,
        updateTimeGroup,
        deleteTimeGroup,
    }
}
