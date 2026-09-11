"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import type { RouteDestination } from "@/components/RouteDestination/route-destination-field"

export type DidStatus = "active" | "inactive" | "blocked"

export type DidUsedByRef = {
    inboundRouteId: string
    name: string
    destination: RouteDestination
}

export type Did = {
    id: string
    number: string
    companyId: string
    status: DidStatus
    usedBy: DidUsedByRef[]
    notes: string | null
    createdAt: string
    updatedAt: string
}

// Espelha createDidSchema/updateDidSchema de backend/src/modules/dids/schemas/did.schema.ts
export const createDidSchema = z.object({
    number: z.string().regex(/^\d+$/, "Apenas dígitos são permitidos"),
    companyId: z.string().min(1, "Selecione a empresa"),
    notes: z.string().max(10000).optional(),
})

export const updateDidSchema = z.object({
    number: z.string().regex(/^\d+$/, "Apenas dígitos são permitidos"),
    status: z.enum(["active", "inactive", "blocked"], "Selecione um status"),
    companyId: z.string().min(1, "Selecione a empresa"),
    notes: z.string().max(10000).optional(),
})

export type DidCreateForm = z.infer<typeof createDidSchema>
export type DidUpdateForm = z.infer<typeof updateDidSchema>

async function fetchDidsRequest(companyId?: string): Promise<Did[]> {
    const { data } = await api.get("/dids", {
        params: companyId ? { companyId } : undefined,
    })
    return data.dids ?? []
}

// sem companyId ("Todas as empresas") também busca: o backend já retorna tudo dentro
// do escopo do usuário quando ?companyId é omitido (ver dids.controller.ts)
export function useDids(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: dids = [], isLoading: loading } = useQuery({
        queryKey: ["dids", companyId],
        queryFn: () => fetchDidsRequest(companyId),
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["dids"] })

    const createMutation = useMutation({
        mutationFn: (form: DidCreateForm) => api.post("/dids", form),
    })

    const createDid = async (form: DidCreateForm) => {
        const id = toast.loading("Criando DID...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("DID criado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar DID"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({ didId, form }: { didId: string; form: DidUpdateForm }) =>
            api.put(`/dids/${didId}`, form),
    })

    const updateDid = async (didId: string, form: DidUpdateForm) => {
        const id = toast.loading("Atualizando DID...")
        try {
            await updateMutation.mutateAsync({ didId, form })
            toast.success("DID atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar DID"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (didId: string) => api.delete(`/dids/${didId}`),
    })

    const deleteDid = async (didId: string) => {
        const id = toast.loading("Deletando DID...")
        try {
            await deleteMutation.mutateAsync(didId)
            toast.success("DID deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar DID"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            dids.filter((d) =>
                d.number.toLowerCase().includes(filter.toLowerCase())
            ),
        [dids, filter]
    )

    return {
        dids: filtered,
        loading,
        filter,
        setFilter,
        fetchDids: invalidate,
        createDid,
        updateDid,
        deleteDid,
    }
}
