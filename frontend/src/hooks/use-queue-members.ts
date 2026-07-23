"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

// Espelha QueueMemberSchema de backend/src/modules/queue-members/schemas/queue-member.schema.ts —
// a resposta não inclui o objeto extension nem created/updatedAt, só os campos abaixo
export type QueueMember = {
    id: string
    queueId: string
    extensionId: string
    penalty: number
    paused: boolean
    pauseReason: string | null
}

export const addQueueMemberSchema = z.object({
    extensionId: z.string().min(1, "Selecione um ramal"),
    penalty: z
        .number()
        .int()
        .min(0, "Mínimo 0")
        .max(100, "Máximo 100")
        .default(0),
    paused: z.boolean().default(false),
})

export type AddQueueMemberForm = z.infer<typeof addQueueMemberSchema>

export type UpdateQueueMemberForm = {
    penalty?: number
    paused?: boolean
    pauseReason?: string | null
}

async function fetchMembersRequest(queueId: string): Promise<QueueMember[]> {
    const { data } = await api.get(`/queues/${queueId}/members`)
    return data.members ?? []
}

export function useQueueMembers(queueId?: string) {
    const queryClient = useQueryClient()

    const { data: members = [], isLoading: loading } = useQuery({
        queryKey: ["queue-members", queueId],
        queryFn: () => fetchMembersRequest(queueId as string),
        enabled: !!queueId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["queue-members", queueId] })

    const addMutation = useMutation({
        mutationFn: (form: AddQueueMemberForm) =>
            api.post(`/queues/${queueId}/members`, form),
    })

    const addMember = async (form: AddQueueMemberForm) => {
        if (!queueId) return false
        const id = toast.loading("Adicionando membro...")
        try {
            await addMutation.mutateAsync(form)
            toast.success("Membro adicionado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao adicionar membro"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            memberId,
            form,
        }: {
            memberId: string
            form: UpdateQueueMemberForm
        }) => api.put(`/queues/${queueId}/members/${memberId}`, form),
    })

    const updateMember = async (
        memberId: string,
        form: UpdateQueueMemberForm
    ) => {
        if (!queueId) return false
        const id = toast.loading("Atualizando membro...")
        try {
            await updateMutation.mutateAsync({ memberId, form })
            toast.success("Membro atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar membro"), { id })
            return false
        }
    }

    const removeMutation = useMutation({
        mutationFn: (memberId: string) =>
            api.delete(`/queues/${queueId}/members/${memberId}`),
    })

    const removeMember = async (memberId: string) => {
        if (!queueId) return false
        const id = toast.loading("Removendo membro...")
        try {
            await removeMutation.mutateAsync(memberId)
            toast.success("Membro removido", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao remover membro"), { id })
            return false
        }
    }

    return {
        members,
        loading,
        fetchMembers: invalidate,
        addMember,
        updateMember,
        removeMember,
    }
}
