"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
    // null = recorrente todo ano; preenchido = válido só nesse ano (feriado móvel, ex: Carnaval)
    year: number | null
}

export type HolidayGroup = {
    id: string
    name: string
    companyId: string
    url: string | null
    // não são mais editáveis por aqui - só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantidos no tipo só porque a
    // API ainda devolve os campos (label resolvido, usado em telas de leitura)
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    dates: HolidayDate[]
    notes: string | null
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

// Validação de range fica no superRefine abaixo (só roda no modo "manual") - aqui só o shape,
// senão o array `dates` residual do modo "url" (não usado, ver toApiPayload) bloqueia o submit
// inteiro do form com erro invisível (não há UI de erro de `dates` no modo "url")
const holidayDateFormSchema = z.object({
    name: z.string().max(80, "Máximo 80 caracteres"),
    month: z.coerce.number().int(),
    day: z.coerce.number().int(),
    // vazio = recorrente todo ano; preenchido = só nesse ano (feriado móvel, ex: Carnaval)
    year: z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
        z.number().int().optional()
    ),
})

// "mode" é só de UI (decide se manda url ou dates pro backend) - não existe no schema do backend,
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
        notes: z.string().max(10000, "Máximo 10000 caracteres").optional(),
    })
    .superRefine((d, ctx) => {
        if (d.mode === "url") {
            if (!(d.url?.trim().length ?? 0)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Informe a URL",
                    path: ["url"],
                })
            }
            return
        }
        d.dates.forEach((date, i) => {
            if (date.name.trim().length < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Informe o nome",
                    path: ["dates", i, "name"],
                })
            }
            if (date.month < 1 || date.month > 12) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Mês inválido",
                    path: ["dates", i, "month"],
                })
            }
            if (date.day < 1 || date.day > 31) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Dia inválido",
                    path: ["dates", i, "day"],
                })
            }
            if (
                date.year !== undefined &&
                (date.year < 1900 || date.year > 2100)
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Ano inválido",
                    path: ["dates", i, "year"],
                })
            }
        })
    })

export type HolidayGroupForm = z.infer<typeof createHolidayGroupFormSchema>
// dialog sempre lida com o shape de criação (companyId incluso, mesmo escondido/desabilitado em
// edição) - update só ignora companyId na hora de montar o payload, mesmo padrão de
// time-conditions.tsx (page.tsx monta o objeto reduzido na hora de chamar updateX)
export type HolidayGroupUpdateForm = Omit<HolidayGroupForm, "companyId">

// DTO de criação a partir do registro salvo (sem companyId - recriação sempre usa a empresa do
// flow) - usado pelo histórico de undo/redo do Flow pra recriar o recurso quando o usuário desfaz
// uma exclusão (ver flow-canvas.tsx). `dates` da entidade tem `id` (HolidayDate.id); o form de
// criação não tem esse campo, então é descartado aqui.
export function toHolidayGroupCreationDto(
    holidayGroup: HolidayGroup
): HolidayGroupUpdateForm {
    return {
        name: holidayGroup.name,
        mode: holidayGroup.url ? "url" : "manual",
        url: holidayGroup.url ?? undefined,
        dates: holidayGroup.dates.map(({ name, month, day, year }) => ({
            name,
            month,
            day,
            year: year ?? undefined,
        })),
        notes: holidayGroup.notes ?? undefined,
    }
}

// payload real da API - "mode" nunca é enviado, só decide se url ou dates vai no corpo
function toApiPayload(form: HolidayGroupUpdateForm) {
    return {
        name: form.name,
        url: form.mode === "url" ? form.url : null,
        dates: form.mode === "manual" ? form.dates : undefined,
        notes: form.notes,
    }
}

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
async function fetchHolidayGroupsRequest(
    companyId: string
): Promise<HolidayGroup[]> {
    const { data } = await api.get("/holiday-groups", { params: { companyId } })
    return data.holidayGroups ?? []
}

export function useHolidayGroups(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: holidayGroups = [], isLoading: loading } = useQuery({
        queryKey: ["holiday-groups", companyId],
        queryFn: () => fetchHolidayGroupsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["holiday-groups"] })

    const createMutation = useMutation({
        mutationFn: (form: HolidayGroupForm) =>
            api.post("/holiday-groups", {
                companyId: form.companyId,
                ...toApiPayload(form),
            }),
    })

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
            const { data } = await createMutation.mutateAsync(form)
            toast.success("Grupo de feriados criado", { id })
            await invalidate()
            return withResourceId ? (data.holidayGroupId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar grupo de feriados"), {
                id,
            })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            holidayGroupId,
            form,
        }: {
            holidayGroupId: string
            form: HolidayGroupUpdateForm
        }) => api.put(`/holiday-groups/${holidayGroupId}`, toApiPayload(form)),
    })

    const updateHolidayGroup = async (
        holidayGroupId: string,
        form: HolidayGroupUpdateForm
    ) => {
        const id = toast.loading("Atualizando grupo de feriados...")
        try {
            await updateMutation.mutateAsync({ holidayGroupId, form })
            toast.success("Grupo de feriados atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar grupo de feriados"), {
                id,
            })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (holidayGroupId: string) =>
            api.delete(`/holiday-groups/${holidayGroupId}`),
    })

    const deleteHolidayGroup = async (holidayGroupId: string) => {
        const id = toast.loading("Deletando grupo de feriados...")
        try {
            await deleteMutation.mutateAsync(holidayGroupId)
            toast.success("Grupo de feriados deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar grupo de feriados"), {
                id,
            })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            holidayGroups.filter((hg) =>
                hg.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [holidayGroups, filter]
    )

    return {
        holidayGroups: filtered,
        loading,
        filter,
        setFilter,
        fetchHolidayGroups: invalidate,
        createHolidayGroup,
        updateHolidayGroup,
        deleteHolidayGroup,
    }
}
