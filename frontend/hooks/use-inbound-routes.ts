"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { routeDestinationSchema, type RouteDestination } from "@/components/RouteDestination/route-destination-field"

export type InboundRoute = {
    id: string
    name: string
    companyId: string
    didId: string
    trunkId: string
    did: { id: string; number: string }
    trunk: { id: string; name: string }
    destination: RouteDestination
    createdAt: string
    updatedAt: string
}

// Espelha create/updateInboundRouteSchema de backend/src/modules/inbound-routes/schemas/inbound-route.schema.ts
// didId/trunkId só existem no create — o PUT do backend só aceita name/destination
export const createInboundRouteFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    didId: z.string().min(1, "Selecione um DID"),
    trunkId: z.string().min(1, "Selecione um tronco"),
    destination: routeDestinationSchema,
})

export const updateInboundRouteFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    destination: routeDestinationSchema,
})

export type InboundRouteForm = z.infer<typeof createInboundRouteFormSchema>
export type InboundRouteUpdateForm = z.infer<typeof updateInboundRouteFormSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createRoute, pois pode divergir deste filtro
// ao editar uma rota específica)
export function useInboundRoutes(companyId?: string) {
    const [routes, setRoutes] = useState<InboundRoute[]>([])
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
            const { data } = await api.get("/inbound-routes", {
                params: { companyId },
            })
            setRoutes(data.inboundRoutes ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar rotas de entrada"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createRoute = async (form: InboundRouteForm, targetCompanyId: string) => {
        const id = toast.loading("Criando rota de entrada...")
        try {
            await api.post("/inbound-routes", { ...form, companyId: targetCompanyId })
            toast.success("Rota de entrada criada", { id })
            await fetchRoutes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar rota de entrada"), { id })
            return false
        }
    }

    const updateRoute = async (routeId: string, form: InboundRouteUpdateForm) => {
        const id = toast.loading("Atualizando rota de entrada...")
        try {
            await api.put(`/inbound-routes/${routeId}`, form)
            toast.success("Rota de entrada atualizada", { id })
            await fetchRoutes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar rota de entrada"), { id })
            return false
        }
    }

    const deleteRoute = async (routeId: string) => {
        const id = toast.loading("Deletando rota de entrada...")
        try {
            await api.delete(`/inbound-routes/${routeId}`)
            toast.success("Rota de entrada deletada", { id })
            await fetchRoutes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar rota de entrada"), { id })
            return false
        }
    }

    const filtered = routes.filter((r) =>
        `${r.name} ${r.did.number} ${r.trunk.name}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
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
