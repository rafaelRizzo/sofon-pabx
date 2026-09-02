"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type Voice = {
    voiceId: string
    name: string
    previewUrl: string | null
    languages: string[]
    accent: string | null
    gender: string | null
    age: string | null
    description: string | null
}

async function fetchVoicesRequest(
    companyId: string,
    refresh = false
): Promise<Voice[]> {
    const { data } = await api.get("/audios/tts/voices", {
        params: { companyId, refresh: refresh || undefined },
    })
    return data.voices ?? []
}

// Cache via TanStack Query (staleTime 5min) - evita refetch a cada vez que o dialog "Gerar
// áudio por voz" reabre; o backend já cacheia a mesma lista por 1h (Redis, ver audios.cache.ts),
// isso só evita o round-trip HTTP repetido enquanto o usuário navega pela mesma sessão.
export function useTtsVoices(
    companyId?: string,
    options?: { enabled?: boolean }
) {
    const queryClient = useQueryClient()
    const [refreshing, setRefreshing] = useState(false)

    const { data: voices = [], isLoading: loading } = useQuery({
        queryKey: ["tts-voices", companyId],
        queryFn: () => fetchVoicesRequest(companyId as string),
        enabled: !!companyId && (options?.enabled ?? true),
        staleTime: 5 * 60 * 1000,
    })

    // Ignora o cache de 1h do backend - pra quando a voz foi adicionada/removida agora mesmo
    // na conta ElevenLabs e ainda não bateu o TTL
    const refreshVoices = async () => {
        if (!companyId) return
        setRefreshing(true)
        try {
            const fresh = await fetchVoicesRequest(companyId, true)
            queryClient.setQueryData(["tts-voices", companyId], fresh)
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar vozes"))
        } finally {
            setRefreshing(false)
        }
    }

    return { voices, loading, refreshing, refreshVoices }
}
