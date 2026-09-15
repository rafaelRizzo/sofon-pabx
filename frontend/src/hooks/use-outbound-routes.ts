"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type OutboundDialPattern = {
    id: string
    routeId: string
    pattern: string
    prefix: string | null
    prepend: string | null
    position: number
}

export type OutboundRouteTrunkLink = {
    id: string
    trunkId: string
    position: number
}
export type OutboundRouteExtensionLink = { id: string; extensionId: string }

export type OutboundRoute = {
    id: string
    name: string
    companyId: string
    position: number
    patterns: OutboundDialPattern[]
    trunks: OutboundRouteTrunkLink[]
    extensions: OutboundRouteExtensionLink[]
    notes: string | null
    createdAt: string
    updatedAt: string
}

const optNumber = (min: number) =>
    z.preprocess(
        (v) =>
            v === "" || v === undefined || v === null ? undefined : Number(v),
        z.number().int().min(min, `Mínimo ${min}`)
    )

const patternFieldSchema = z.object({
    pattern: z
        .string()
        .min(1, "Informe o padrão")
        .max(40, "Máximo 40 caracteres"),
    prepend: z.string().max(40, "Máximo 40 caracteres").optional(),
    prefix: z.string().max(40, "Máximo 40 caracteres").optional(),
})

// Espelha create/updateOutboundRouteSchema de backend/src/modules/outbound-routes/schemas/outbound-route.schema.ts
// A posição de cada pattern/trunk é derivada da ordem no array (índice) - não exposta no form
export const outboundRouteFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    position: optNumber(0),
    trunkIds: z.array(z.string()).min(1, "Selecione ao menos um tronco"),
    patterns: z.array(patternFieldSchema).min(1, "Adicione ao menos um padrão"),
    // Opcional: restringe a rota a ramais específicos (vazio = disponível para todos)
    extensionIds: z.array(z.string()).optional(),
    notes: z.string().max(10000, "Máximo 10000 caracteres").optional(),
})

// Presets de padrões de discagem comuns no Brasil. Prepend fica sempre a critério do usuário
// (depende do tronco/operadora). O "0" de acesso interurbano vai no prefix, não no pattern -
// senão o usuário teria que digitar esse dígito duas vezes (aqui e em "Remover prefixo") pra
// funcionar, já que o Asterisk casa prefix+pattern combinados (ver buildFullDialPattern).
export const DIAL_PATTERN_PRESETS = [
    { label: "Celular local (9 dígitos)", prefix: "", pattern: `_9${"X".repeat(8)}` },
    { label: "Fixo local (8 dígitos)", prefix: "", pattern: `_${"X".repeat(8)}` },
    {
        // DDD nunca começa com 0 (Z = 1-9) - só o 2º dígito do DDD é livre (X = 0-9)
        label: "Interurbano fixo (0 + DDD + fixo)",
        prefix: "0",
        pattern: `_ZX${"X".repeat(8)}`,
    },
    {
        label: "Interurbano celular (0 + DDD + celular)",
        prefix: "0",
        pattern: `_ZX9${"X".repeat(8)}`,
    },
    { label: "0800 (11 dígitos)", prefix: "", pattern: `_0800${"X".repeat(7)}` },
    {
        label: "Utilidade pública (3 dígitos, ex: 180, 190)",
        prefix: "",
        pattern: `_${"X".repeat(3)}`,
    },
    { label: "Internacional (00 + país)", prefix: "", pattern: "_00." },
] as const

const ASTERISK_PATTERN_WILDCARDS = /[XZN.!]/i

// Espelha buildFullExten de backend/src/modules/outbound-routes/outbound-routes.service.ts - o
// Asterisk casa prefix+pattern combinados, então o preview e a checagem de duplicidade no form
// precisam considerar os dois campos juntos, não só o texto digitado em "Padrão".
export function buildFullDialPattern(
    prefix: string | null | undefined,
    pattern: string
): string {
    const bare = pattern.startsWith("_") ? pattern.slice(1) : pattern
    const combined = `${prefix ?? ""}${bare}`
    return ASTERISK_PATTERN_WILDCARDS.test(combined) ? `_${combined}` : combined
}

export type OutboundRouteForm = z.infer<typeof outboundRouteFormSchema>

const toPayload = (form: OutboundRouteForm) => ({
    name: form.name,
    position: form.position,
    trunkIds: form.trunkIds,
    patterns: form.patterns.map((p, i) => ({
        pattern: p.pattern,
        prepend: p.prepend || undefined,
        prefix: p.prefix || undefined,
        position: i,
    })),
    notes: form.notes,
})

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createRoute, pois pode divergir deste filtro
// ao editar uma rota específica)
async function fetchOutboundRoutesRequest(
    companyId: string
): Promise<OutboundRoute[]> {
    const { data } = await api.get("/outbound-routes", { params: { companyId } })
    return data.routes ?? []
}

export function useOutboundRoutes(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: routes = [], isLoading: loading } = useQuery({
        queryKey: ["outbound-routes", companyId],
        queryFn: () => fetchOutboundRoutesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["outbound-routes"] })

    const createMutation = useMutation({
        mutationFn: ({
            form,
            targetCompanyId,
        }: {
            form: OutboundRouteForm
            targetCompanyId: string
        }) =>
            api.post("/outbound-routes", {
                ...toPayload(form),
                companyId: targetCompanyId,
                extensionIds: form.extensionIds?.length
                    ? form.extensionIds
                    : undefined,
            }),
    })

    const createRoute = async (
        form: OutboundRouteForm,
        targetCompanyId: string
    ) => {
        const id = toast.loading("Criando rota de saída...")
        try {
            await createMutation.mutateAsync({ form, targetCompanyId })
            toast.success("Rota de saída criada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar rota de saída"), { id })
            return false
        }
    }

    const updateRoute = async (routeId: string, form: OutboundRouteForm) => {
        const id = toast.loading("Atualizando rota de saída...")
        try {
            await api.put(`/outbound-routes/${routeId}`, toPayload(form))

            // Restrição a ramais não faz parte do PUT em lote - endpoints próprios de add/remove
            const existing = routes.find((r) => r.id === routeId)
            const currentExtensionIds =
                existing?.extensions.map((e) => e.extensionId) ?? []
            const nextExtensionIds = form.extensionIds ?? []
            const toAdd = nextExtensionIds.filter(
                (eid) => !currentExtensionIds.includes(eid)
            )
            const toRemove = currentExtensionIds.filter(
                (eid) => !nextExtensionIds.includes(eid)
            )
            await Promise.all([
                ...toAdd.map((eid) =>
                    api.post(`/outbound-routes/${routeId}/extensions`, {
                        extensionId: eid,
                    })
                ),
                ...toRemove.map((eid) =>
                    api.delete(`/outbound-routes/${routeId}/extensions/${eid}`)
                ),
            ])

            toast.success("Rota de saída atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar rota de saída"), {
                id,
            })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (routeId: string) =>
            api.delete(`/outbound-routes/${routeId}`),
    })

    const deleteRoute = async (routeId: string) => {
        const id = toast.loading("Deletando rota de saída...")
        try {
            await deleteMutation.mutateAsync(routeId)
            toast.success("Rota de saída deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar rota de saída"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            routes.filter((r) =>
                r.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [routes, filter]
    )

    return {
        routes: filtered,
        allRoutes: routes,
        loading,
        filter,
        setFilter,
        fetchRoutes: invalidate,
        createRoute,
        updateRoute,
        deleteRoute,
    }
}
