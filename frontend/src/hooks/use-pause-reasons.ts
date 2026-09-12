"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type PauseReason = {
    id: string
    companyId: string
    label: string
    active: boolean
    createdAt: string
    updatedAt: string
}

// Espelha createPauseReasonSchema/updatePauseReasonSchema de
// backend/src/modules/callcenter/pause-reasons/schemas/pause-reason.schema.ts
export const pauseReasonFormSchema = z.object({
    companyId: z.string().min(1, "Selecione uma empresa"),
    label: z.string().min(1, "Informe um motivo").max(60),
    active: z.boolean().default(true),
})

export type PauseReasonForm = z.infer<typeof pauseReasonFormSchema>

async function fetchPauseReasonsRequest(companyId: string): Promise<PauseReason[]> {
    const { data } = await api.get(`/callcenter/pause-reasons/company/${companyId}`)
    return data.pauseReasons ?? []
}

export function usePauseReasons(companyId?: string) {
    const queryClient = useQueryClient()

    const { data: pauseReasons = [], isLoading: loading } = useQuery({
        queryKey: ["pause-reasons", companyId],
        queryFn: () => fetchPauseReasonsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["pause-reasons"] })

    const createMutation = useMutation({
        mutationFn: (form: PauseReasonForm) =>
            api.post("/callcenter/pause-reasons", form),
    })

    const createPauseReason = async (form: PauseReasonForm) => {
        const id = toast.loading("Criando motivo de pausa...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Motivo de pausa criado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar motivo de pausa"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            reasonId,
            data,
        }: {
            reasonId: string
            data: Partial<Pick<PauseReasonForm, "label" | "active">>
        }) => api.patch(`/callcenter/pause-reasons/${reasonId}`, data),
    })

    const updatePauseReason = async (
        reasonId: string,
        data: Partial<Pick<PauseReasonForm, "label" | "active">>
    ) => {
        const id = toast.loading("Salvando motivo de pausa...")
        try {
            await updateMutation.mutateAsync({ reasonId, data })
            toast.success("Motivo de pausa atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar motivo de pausa"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (reasonId: string) =>
            api.delete(`/callcenter/pause-reasons/${reasonId}`),
    })

    const deletePauseReason = async (reasonId: string) => {
        const id = toast.loading("Removendo motivo de pausa...")
        try {
            await deleteMutation.mutateAsync(reasonId)
            toast.success("Motivo de pausa removido", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao remover motivo de pausa"), { id })
            return false
        }
    }

    return {
        pauseReasons,
        loading,
        createPauseReason,
        updatePauseReason,
        deletePauseReason,
    }
}
