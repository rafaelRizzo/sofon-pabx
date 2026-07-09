"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type DidStatus = "active" | "inactive" | "blocked"

export type Did = {
    id: string
    number: string
    companyId: string
    status: DidStatus
    createdAt: string
    updatedAt: string
}

// Espelha createDidSchema/updateDidSchema de backend/src/modules/dids/schemas/did.schema.ts
export const createDidSchema = z.object({
    number: z.string().regex(/^\d+$/, "Apenas dígitos são permitidos"),
    companyId: z.string().min(1, "Selecione a empresa"),
})

export const updateDidSchema = z.object({
    number: z.string().regex(/^\d+$/, "Apenas dígitos são permitidos"),
    status: z.enum(["active", "inactive", "blocked"], "Selecione um status"),
})

export type DidCreateForm = z.infer<typeof createDidSchema>
export type DidUpdateForm = z.infer<typeof updateDidSchema>

export function useDids(companyId?: string) {
    const [dids, setDids] = useState<Did[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchDids = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/dids", {
                params: companyId ? { companyId } : undefined,
            })
            setDids(data.dids ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar DIDs"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createDid = async (form: DidCreateForm) => {
        const id = toast.loading("Criando DID...")
        try {
            await api.post("/dids", form)
            toast.success("DID criado", { id })
            await fetchDids()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar DID"), { id })
            return false
        }
    }

    const updateDid = async (didId: string, form: DidUpdateForm) => {
        const id = toast.loading("Atualizando DID...")
        try {
            await api.put(`/dids/${didId}`, form)
            toast.success("DID atualizado", { id })
            await fetchDids()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar DID"), { id })
            return false
        }
    }

    const deleteDid = async (didId: string) => {
        const id = toast.loading("Deletando DID...")
        try {
            await api.delete(`/dids/${didId}`)
            toast.success("DID deletado", { id })
            await fetchDids()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar DID"), { id })
            return false
        }
    }

    const filtered = dids.filter((d) =>
        d.number.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchDids()
    }, [fetchDids, companyId])

    return {
        dids: filtered,
        loading,
        filter,
        setFilter,
        fetchDids,
        createDid,
        updateDid,
        deleteDid,
    }
}
