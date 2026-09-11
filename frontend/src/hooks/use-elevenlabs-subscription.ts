"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export type ElevenLabsSubscription = {
    tier: string
    characterCount: number
    characterLimit: number
    canExtendCharacterLimit: boolean
    nextCharacterCountResetUnix: number | null
    status: string
    currency: string
    voiceSlotsUsed: number
    voiceLimit: number
}

async function fetchSubscriptionRequest(
    companyId: string
): Promise<ElevenLabsSubscription> {
    const { data } = await api.get("/audios/tts/subscription", {
        params: { companyId },
    })
    return data.subscription
}

// Sem staleTime/cache local proposital - saldo de caracteres muda a cada TTS gerado, então toda
// vez que o dialog reabre (ou troca de empresa) o valor precisa ser buscado de novo. O backend
// também não cacheia essa rota (ver audios.service.ts:getSubscription).
export function useElevenLabsSubscription(
    companyId?: string,
    options?: { enabled?: boolean }
) {
    const { data: subscription, isLoading: loading, isError } = useQuery({
        queryKey: ["elevenlabs-subscription", companyId],
        queryFn: () => fetchSubscriptionRequest(companyId as string),
        enabled: !!companyId && (options?.enabled ?? true),
        staleTime: 0,
        retry: false,
    })

    return { subscription, loading, isError }
}
