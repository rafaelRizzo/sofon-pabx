"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type Voice = {
    voiceId: string
    name: string
    previewUrl: string | null
    languages: string[]
}

// Busca sob demanda (chamada só quando a aba "Gerar por voz" é aberta com uma empresa
// selecionada), não no mount da página. Vozes são da conta ElevenLabs da própria empresa
// (Company.elevenLabsApiKey), então o cache é invalidado ao trocar de empresa.
export function useTtsVoices() {
    const [voices, setVoices] = useState<Voice[]>([])
    const [loading, setLoading] = useState(false)
    const fetchedForRef = useRef<string | null>(null)

    const fetchVoices = useCallback(async (companyId: string) => {
        if (!companyId || fetchedForRef.current === companyId) return
        setLoading(true)
        try {
            const { data } = await api.get("/audios/tts/voices", {
                params: { companyId },
            })
            setVoices(data.voices ?? [])
            fetchedForRef.current = companyId
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar vozes"))
        } finally {
            setLoading(false)
        }
    }, [])

    return { voices, loading, fetchVoices }
}
