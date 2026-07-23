"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
async function fetchAnnouncementsRequest(
    companyId: string
): Promise<Announcement[]> {
    const { data } = await api.get("/announcements", { params: { companyId } })
    return data.announcements ?? []
}

export function useAnnouncements(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: announcements = [], isLoading: loading } = useQuery({
        queryKey: ["announcements", companyId],
        queryFn: () => fetchAnnouncementsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["announcements"] })

    const createMutation = useMutation({
        mutationFn: ({
            form,
            targetCompanyId,
        }: {
            form: AnnouncementForm
            targetCompanyId: string
        }) =>
            api.post("/announcements", { ...form, companyId: targetCompanyId }),
    })

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
            const { data } = await createMutation.mutateAsync({
                form,
                targetCompanyId,
            })
            toast.success("Anúncio criado", { id })
            await invalidate()
            return withResourceId ? (data.announcementId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar anúncio"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            announcementId,
            form,
        }: {
            announcementId: string
            form: AnnouncementForm
        }) => api.patch(`/announcements/${announcementId}`, form),
    })

    const updateAnnouncement = async (
        announcementId: string,
        form: AnnouncementForm
    ) => {
        const id = toast.loading("Atualizando anúncio...")
        try {
            await updateMutation.mutateAsync({ announcementId, form })
            toast.success("Anúncio atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar anúncio"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (announcementId: string) =>
            api.delete(`/announcements/${announcementId}`),
    })

    const deleteAnnouncement = async (announcementId: string) => {
        const id = toast.loading("Deletando anúncio...")
        try {
            await deleteMutation.mutateAsync(announcementId)
            toast.success("Anúncio deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar anúncio"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            announcements.filter((a) =>
                a.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [announcements, filter]
    )

    return {
        announcements: filtered,
        allAnnouncements: announcements,
        loading,
        filter,
        setFilter,
        fetchAnnouncements: invalidate,
        createAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
    }
}
