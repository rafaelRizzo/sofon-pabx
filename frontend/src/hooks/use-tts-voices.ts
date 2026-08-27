"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export type Voice = {
    voiceId: string
    name: string
    previewUrl: string | null
    languages: string[]
}

async function fetchVoicesRequest(companyId: string): Promise<Voice[]> {
    const { data } = await api.get("/audios/tts/voices", {
        params: { companyId },
    })
    return data.voices ?? []
}

// Cache via TanStack Query (staleTime 5min) — evita refetch a cada vez que o dialog "Gerar
// áudio por voz" reabre; o backend já cacheia a mesma lista por 1h (Redis, ver audios.cache.ts),
// isso só evita o round-trip HTTP repetido enquanto o usuário navega pela mesma sessão.
export function useTtsVoices(
    companyId?: string,
    options?: { enabled?: boolean }
) {
    const { data: voices = [], isLoading: loading } = useQuery({
        queryKey: ["tts-voices", companyId],
        queryFn: () => fetchVoicesRequest(companyId as string),
        enabled: !!companyId && (options?.enabled ?? true),
        staleTime: 5 * 60 * 1000,
    })

    return { voices, loading }
}
