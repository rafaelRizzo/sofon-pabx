"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type HolidayDate = {
    id: string
    name: string
    month: number
    day: number
}

export type HolidayGroup = {
    id: string
    name: string
    companyId: string
    url: string | null
    // não são mais editáveis por aqui — só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantidos no tipo só porque a
    // API ainda devolve os campos (label resolvido, usado em telas de leitura)
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    dates: HolidayDate[]
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

const holidayDateFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    month: z.coerce
        .number()
        .int()
        .min(1, "Mês inválido")
        .max(12, "Mês inválido"),
    day: z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido"),
})

// "mode" é só de UI (decide se manda url ou dates pro backend) — não existe no schema do backend,
// que valida url/dates como mutuamente exclusivos (ver create/updateHolidayGroupSchema)
export const createHolidayGroupFormSchema = z
    .object({
        name: z
            .string()
            .min(1, "Informe o nome")
            .max(80, "Máximo 80 caracteres"),
        companyId: z.string().min(1, "Selecione uma empresa"),
        mode: z.enum(["manual", "url"]),
        url: z.string().max(500).optional(),
        dates: z.array(holidayDateFormSchema).max(50),
    })
    .refine((d) => d.mode !== "url" || (d.url?.trim().length ?? 0) > 0, {
        message: "Informe a URL",
        path: ["url"],
    })

export type HolidayGroupForm = z.infer<typeof createHolidayGroupFormSchema>
// dialog sempre lida com o shape de criação (companyId incluso, mesmo escondido/desabilitado em
// edição) — update só ignora companyId na hora de montar o payload, mesmo padrão de
// time-conditions.tsx (page.tsx monta o objeto reduzido na hora de chamar updateX)
export type HolidayGroupUpdateForm = Omit<HolidayGroupForm, "companyId">

// payload real da API — "mode" nunca é enviado, só decide se url ou dates vai no corpo
function toApiPayload(form: HolidayGroupUpdateForm) {
    return {
        name: form.name,
        url: form.mode === "url" ? form.url : null,
        dates: form.mode === "manual" ? form.dates : undefined,
    }
}

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useHolidayGroups(companyId?: string) {
    const [holidayGroups, setHolidayGroups] = useState<HolidayGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchHolidayGroups = useCallback(async () => {
        if (!companyId) {
            setHolidayGroups([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/holiday-groups", {
                params: { companyId },
            })
            setHolidayGroups(data.holidayGroups ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar grupos de feriados"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId do grupo vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    async function createHolidayGroup(form: HolidayGroupForm): Promise<boolean>
    async function createHolidayGroup(
        form: HolidayGroupForm,
        withResourceId: true
    ): Promise<string | null>
    async function createHolidayGroup(
        form: HolidayGroupForm,
        withResourceId = false
    ) {
        const id = toast.loading("Criando grupo de feriados...")
        try {
            const { data } = await api.post("/holiday-groups", {
                companyId: form.companyId,
                ...toApiPayload(form),
            })
            toast.success("Grupo de feriados criado", { id })
            await fetchHolidayGroups()
            return withResourceId ? (data.holidayGroupId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar grupo de feriados"), {
                id,
            })
            return withResourceId ? null : false
        }
    }

    const updateHolidayGroup = async (
        holidayGroupId: string,
        form: HolidayGroupUpdateForm
    ) => {
        const id = toast.loading("Atualizando grupo de feriados...")
        try {
            await api.put(
                `/holiday-groups/${holidayGroupId}`,
                toApiPayload(form)
            )
            toast.success("Grupo de feriados atualizado", { id })
            await fetchHolidayGroups()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar grupo de feriados"), {
                id,
            })
            return false
        }
    }

    const deleteHolidayGroup = async (holidayGroupId: string) => {
        const id = toast.loading("Deletando grupo de feriados...")
        try {
            await api.delete(`/holiday-groups/${holidayGroupId}`)
            toast.success("Grupo de feriados deletado", { id })
            await fetchHolidayGroups()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar grupo de feriados"), {
                id,
            })
            return false
        }
    }

    const filtered = holidayGroups.filter((hg) =>
        hg.name.toLowerCase().includes(filter.toLowerCase())
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
        fetchHolidayGroups()
    }, [fetchHolidayGroups, companyId])

    return {
        holidayGroups: filtered,
        loading,
        filter,
        setFilter,
        fetchHolidayGroups,
        createHolidayGroup,
        updateHolidayGroup,
        deleteHolidayGroup,
    }
}
