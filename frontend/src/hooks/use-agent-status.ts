"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type AgentStatusQueue = {
    queueId: string
    queueName: string
    queueNumber: string
    paused: boolean
    pauseReason: string | null
}

export type AgentStatusReason = {
    id: string
    label: string
}

export type AgentStatus = {
    extensionId: string
    paused: boolean
    pauseReason: string | null
    queues: AgentStatusQueue[]
    availableReasons: AgentStatusReason[]
}

const QUERY_KEY = ["agent-status", "me"]

async function fetchMyStatusRequest(): Promise<AgentStatus | null> {
    try {
        const { data } = await api.get("/callcenter/agent-status/me")
        return data.status
    } catch (err) {
        // sem ramal vinculado é o único caso que o Painel do Agente trata como "sem callcenter
        // pra este usuário" - qualquer outro erro (500, rede) precisa propagar pro isError do
        // useQuery, senão fica indistinguível de "usuário sem ramal"
        if (axios.isAxiosError(err) && err.response?.status === 404) return null
        throw err
    }
}

// Pausa/retoma o agente em TODAS as filas de uma vez (PUT /callcenter/agent-status/me), reusando
// o mesmo endpoint de gestão de fila por baixo (backend/src/modules/callcenter/agent-status) -
// sem mutation por fila aqui, é sempre a ação agregada.
export function useAgentStatus() {
    const queryClient = useQueryClient()

    const { data: status, isLoading: loading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchMyStatusRequest,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })

    const setMutation = useMutation({
        mutationFn: (body: { paused: boolean; pauseReasonId?: string | null }) =>
            api.put("/callcenter/agent-status/me", body),
    })

    const pause = async (pauseReasonId: string) => {
        const id = toast.loading("Pausando...")
        try {
            await setMutation.mutateAsync({ paused: true, pauseReasonId })
            toast.success("Você está pausado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao pausar"), { id })
            return false
        }
    }

    const resume = async () => {
        const id = toast.loading("Retomando...")
        try {
            await setMutation.mutateAsync({ paused: false })
            toast.success("Você está disponível", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao retomar"), { id })
            return false
        }
    }

    return { status, loading, pause, resume }
}
