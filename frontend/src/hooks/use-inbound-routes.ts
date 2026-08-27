"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import {
    routeDestinationSchema,
    type RouteDestination,
} from "@/components/RouteDestination/route-destination-field"

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
// didId/trunkId só existem no create - o PUT do backend só aceita name/destination
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
export type InboundRouteUpdateForm = z.infer<
    typeof updateInboundRouteFormSchema
>

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createRoute, pois pode divergir deste filtro
// ao editar uma rota específica)
async function fetchInboundRoutesRequest(
    companyId: string
): Promise<InboundRoute[]> {
    const { data } = await api.get("/inbound-routes", { params: { companyId } })
    return data.inboundRoutes ?? []
}

export function useInboundRoutes(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: routes = [], isLoading: loading } = useQuery({
        queryKey: ["inbound-routes", companyId],
        queryFn: () => fetchInboundRoutesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["inbound-routes"] })

    const createMutation = useMutation({
        mutationFn: ({
            form,
            targetCompanyId,
        }: {
            form: InboundRouteForm
            targetCompanyId: string
        }) => api.post("/inbound-routes", { ...form, companyId: targetCompanyId }),
    })

    const createRoute = async (
        form: InboundRouteForm,
        targetCompanyId: string
    ) => {
        const id = toast.loading("Criando rota de entrada...")
        try {
            await createMutation.mutateAsync({ form, targetCompanyId })
            toast.success("Rota de entrada criada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar rota de entrada"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            routeId,
            form,
        }: {
            routeId: string
            form: InboundRouteUpdateForm
        }) => api.put(`/inbound-routes/${routeId}`, form),
    })

    const updateRoute = async (
        routeId: string,
        form: InboundRouteUpdateForm
    ) => {
        const id = toast.loading("Atualizando rota de entrada...")
        try {
            await updateMutation.mutateAsync({ routeId, form })
            toast.success("Rota de entrada atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar rota de entrada"), {
                id,
            })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (routeId: string) =>
            api.delete(`/inbound-routes/${routeId}`),
    })

    const deleteRoute = async (routeId: string) => {
        const id = toast.loading("Deletando rota de entrada...")
        try {
            await deleteMutation.mutateAsync(routeId)
            toast.success("Rota de entrada deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar rota de entrada"), {
                id,
            })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            routes.filter((r) =>
                `${r.name} ${r.did.number} ${r.trunk.name}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
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
