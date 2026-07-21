"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type Announcement = {
    id: string
    name: string
    companyId: string
    audioId: string | null
    hasAudio: boolean
    // destino não é mais editável por aqui — só via arrastar uma conexão no canvas do Flow
    // (ver flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantido no tipo só
    // porque a API ainda devolve o campo (label resolvido, usado em telas de leitura)
    destination: RouteDestination
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

// Espelha create/updateAnnouncementSchema de backend/src/modules/announcements/schemas/announcement.schema.ts
// (sem "destination" — ver comentário no tipo Announcement acima)
export const createAnnouncementFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    audioId: z.string().nullable(),
})

export const updateAnnouncementFormSchema = createAnnouncementFormSchema

export type AnnouncementForm = z.infer<typeof createAnnouncementFormSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createAnnouncement, pois pode divergir deste
// filtro ao editar um anúncio específico)
export function useAnnouncements(companyId?: string) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchAnnouncements = useCallback(async () => {
        if (!companyId) {
            setAnnouncements([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/announcements", {
                params: { companyId },
            })
            setAnnouncements(data.announcements ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar anúncios"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    async function createAnnouncement(
        form: AnnouncementForm,
        targetCompanyId: string
    ): Promise<boolean>
    async function createAnnouncement(
        form: AnnouncementForm,
        targetCompanyId: string,
        withResourceId: true
    ): Promise<string | null>
    async function createAnnouncement(
        form: AnnouncementForm,
        targetCompanyId: string,
        withResourceId = false
    ) {
        const id = toast.loading("Criando anúncio...")
        try {
            const { data } = await api.post("/announcements", {
                ...form,
                companyId: targetCompanyId,
            })
            toast.success("Anúncio criado", { id })
            await fetchAnnouncements()
            return withResourceId ? (data.announcementId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar anúncio"), { id })
            return withResourceId ? null : false
        }
    }

    const updateAnnouncement = async (
        announcementId: string,
        form: AnnouncementForm
    ) => {
        const id = toast.loading("Atualizando anúncio...")
        try {
            await api.patch(`/announcements/${announcementId}`, form)
            toast.success("Anúncio atualizado", { id })
            await fetchAnnouncements()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar anúncio"), { id })
            return false
        }
    }

    const deleteAnnouncement = async (announcementId: string) => {
        const id = toast.loading("Deletando anúncio...")
        try {
            await api.delete(`/announcements/${announcementId}`)
            toast.success("Anúncio deletado", { id })
            await fetchAnnouncements()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar anúncio"), { id })
            return false
        }
    }

    const filtered = announcements.filter((a) =>
        a.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({
        fetched: false,
    })

    useEffect(() => {
        if (!companyId) {
            setAnnouncements([])
            setLoading(false)
            fetchStateRef.current = { fetched: false }
            return
        }
        if (
            fetchStateRef.current.fetched &&
            fetchStateRef.current.key === companyId
        )
            return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchAnnouncements()
    }, [fetchAnnouncements, companyId])

    return {
        announcements: filtered,
        allAnnouncements: announcements,
        loading,
        filter,
        setFilter,
        fetchAnnouncements,
        createAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
    }
}
