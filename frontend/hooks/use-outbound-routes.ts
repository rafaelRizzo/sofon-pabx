"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
// A posição de cada pattern/trunk é derivada da ordem no array (índice) — não exposta no form
export const outboundRouteFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    position: optNumber(0),
    trunkIds: z.array(z.string()).min(1, "Selecione ao menos um tronco"),
    patterns: z.array(patternFieldSchema).min(1, "Adicione ao menos um padrão"),
    // Opcional: restringe a rota a ramais específicos (vazio = disponível para todos)
    extensionIds: z.array(z.string()).optional(),
})

// Presets de padrões de discagem comuns no Brasil — apenas preenche o campo "pattern",
// prefix/prepend ficam a critério do usuário (dependem do tronco/operadora)
export const DIAL_PATTERN_PRESETS = [
    { label: "Celular local (9 dígitos)", pattern: `_9${"X".repeat(8)}` },
    { label: "Fixo local (8 dígitos)", pattern: `_${"X".repeat(8)}` },
    {
        label: "Interurbano fixo (0 + DDD + fixo)",
        pattern: `_0${"X".repeat(10)}`,
    },
    {
        label: "Interurbano celular (0 + DDD + celular)",
        pattern: `_0${"X".repeat(11)}`,
    },
    { label: "0800 (11 dígitos)", pattern: `_0800${"X".repeat(7)}` },
    {
        label: "Utilidade pública (3 dígitos, ex: 180, 190)",
        pattern: `_${"X".repeat(3)}`,
    },
    { label: "Internacional (00 + país)", pattern: "_00." },
] as const

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
})

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createRoute, pois pode divergir deste filtro
// ao editar uma rota específica)
export function useOutboundRoutes(companyId?: string) {
    const [routes, setRoutes] = useState<OutboundRoute[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchRoutes = useCallback(async () => {
        if (!companyId) {
            setRoutes([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/outbound-routes", {
                params: { companyId },
            })
            setRoutes(data.routes ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar rotas de saída"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createRoute = async (
        form: OutboundRouteForm,
        targetCompanyId: string
    ) => {
        const id = toast.loading("Criando rota de saída...")
        try {
            await api.post("/outbound-routes", {
                ...toPayload(form),
                companyId: targetCompanyId,
                extensionIds: form.extensionIds?.length
                    ? form.extensionIds
                    : undefined,
            })
            toast.success("Rota de saída criada", { id })
            await fetchRoutes()
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

            // Restrição a ramais não faz parte do PUT em lote — endpoints próprios de add/remove
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
            await fetchRoutes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar rota de saída"), {
                id,
            })
            return false
        }
    }

    const deleteRoute = async (routeId: string) => {
        const id = toast.loading("Deletando rota de saída...")
        try {
            await api.delete(`/outbound-routes/${routeId}`)
            toast.success("Rota de saída deletada", { id })
            await fetchRoutes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar rota de saída"), { id })
            return false
        }
    }

    const filtered = routes.filter((r) =>
        r.name.toLowerCase().includes(filter.toLowerCase())
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
        fetchRoutes()
    }, [fetchRoutes, companyId])

    return {
        routes: filtered,
        allRoutes: routes,
        loading,
        filter,
        setFilter,
        fetchRoutes,
        createRoute,
        updateRoute,
        deleteRoute,
    }
}
