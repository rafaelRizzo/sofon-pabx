"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
    penalty: z.number().int().min(0, "Mínimo 0").max(100, "Máximo 100").default(0),
    paused: z.boolean().default(false),
})

export type AddQueueMemberForm = z.infer<typeof addQueueMemberSchema>

export type UpdateQueueMemberForm = {
    penalty?: number
    paused?: boolean
    pauseReason?: string | null
}

export function useQueueMembers(queueId?: string) {
    const [members, setMembers] = useState<QueueMember[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMembers = useCallback(async () => {
        if (!queueId) {
            setMembers([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get(`/queues/${queueId}/members`)
            setMembers(data.members ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar membros da fila"))
        } finally {
            setLoading(false)
        }
    }, [queueId])

    const addMember = async (form: AddQueueMemberForm) => {
        if (!queueId) return false
        const id = toast.loading("Adicionando membro...")
        try {
            await api.post(`/queues/${queueId}/members`, form)
            toast.success("Membro adicionado", { id })
            await fetchMembers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao adicionar membro"), { id })
            return false
        }
    }

    const updateMember = async (memberId: string, form: UpdateQueueMemberForm) => {
        if (!queueId) return false
        const id = toast.loading("Atualizando membro...")
        try {
            await api.put(`/queues/${queueId}/members/${memberId}`, form)
            toast.success("Membro atualizado", { id })
            await fetchMembers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar membro"), { id })
            return false
        }
    }

    const removeMember = async (memberId: string) => {
        if (!queueId) return false
        const id = toast.loading("Removendo membro...")
        try {
            await api.delete(`/queues/${queueId}/members/${memberId}`)
            toast.success("Membro removido", { id })
            await fetchMembers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao remover membro"), { id })
            return false
        }
    }

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === queueId) return
        fetchStateRef.current = { key: queueId, fetched: true }
        fetchMembers()
    }, [fetchMembers, queueId])

    return {
        members,
        loading,
        fetchMembers,
        addMember,
        updateMember,
        removeMember,
    }
}
