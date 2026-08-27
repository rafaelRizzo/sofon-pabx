"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type Audio = {
    id: string
    name: string
    companyId: string
    source: "UPLOAD" | "TTS"
    ttsText: string | null
    ttsVoiceId: string | null
    createdAt: string
    updatedAt: string
}

async function fetchAudiosRequest(companyId: string): Promise<Audio[]> {
    const { data } = await api.get("/audios", { params: { companyId } })
    return data.audios ?? []
}

function extractFilename(disposition: unknown, fallback: string): string {
    if (typeof disposition !== "string") return fallback
    const match = disposition.match(/filename="?([^"]+)"?/)
    return match?.[1] ?? fallback
}

// Precisa ser via api.get (axios injeta o Bearer token no interceptor) e não <a href>/<audio src>
// direto: o backend autentica por header, não cookie de sessão (mesmo padrão de use-cdr.ts)
async function fetchAudioFileBlob(id: string) {
    const res = await api.get(`/audios/${id}/file`, { responseType: "blob" })
    const filename = extractFilename(
        res.headers["content-disposition"],
        `audio-${id}.wav`
    )
    return { url: URL.createObjectURL(res.data as Blob), filename }
}

export async function downloadAudioFile(id: string, name?: string) {
    const toastId = toast.loading("Baixando áudio...")
    try {
        const { url, filename } = await fetchAudioFileBlob(id)
        const a = document.createElement("a")
        a.href = url
        a.download = name ? `${name}.wav` : filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Áudio baixado", { id: toastId })
    } catch (err) {
        toast.error(apiError(err, "Erro ao baixar áudio"), { id: toastId })
    }
}

// Retorna a blob URL pra tocar inline (<audio>): chamador é responsável por revogar via
// URL.revokeObjectURL quando parar de usar
export async function loadAudioFile(id: string): Promise<string | null> {
    try {
        const { url } = await fetchAudioFileBlob(id)
        return url
    } catch (err) {
        toast.error(apiError(err, "Erro ao carregar áudio"))
        return null
    }
}

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do upload
// (que é passada explicitamente para createAudio, pois pode divergir deste filtro)
export function useAudios(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: audios = [], isLoading: loading } = useQuery({
        queryKey: ["audios", companyId],
        queryFn: () => fetchAudiosRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["audios"] })

    // Multipart: o backend lê file.fields, que só é populado com as partes já recebidas
    // ANTES do arquivo no stream — por isso name/companyId são anexados antes do file
    const createAudio = async (
        file: File,
        name: string,
        targetCompanyId: string
    ) => {
        const id = toast.loading("Enviando áudio...")
        try {
            const form = new FormData()
            form.append("name", name)
            form.append("companyId", targetCompanyId)
            form.append("file", file)
            await api.post("/audios", form)
            toast.success("Áudio enviado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao enviar áudio"), { id })
            return false
        }
    }

    const createAudioFromText = async (
        name: string,
        targetCompanyId: string,
        text: string,
        voiceId: string,
        language: "pt" | "en"
    ) => {
        const id = toast.loading("Gerando áudio...")
        try {
            await api.post("/audios/tts", {
                name,
                companyId: targetCompanyId,
                text,
                voiceId,
                language,
            })
            toast.success("Áudio gerado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao gerar áudio"), { id })
            return false
        }
    }

    const updateAudio = async (audioId: string, name: string) => {
        const id = toast.loading("Renomeando áudio...")
        try {
            await api.patch(`/audios/${audioId}`, { name })
            toast.success("Áudio renomeado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao renomear áudio"), { id })
            return false
        }
    }

    const deleteAudio = async (audioId: string) => {
        const id = toast.loading("Deletando áudio...")
        try {
            await api.delete(`/audios/${audioId}`)
            toast.success("Áudio deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar áudio"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            audios.filter((a) =>
                a.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [audios, filter]
    )

    return {
        audios: filtered,
        allAudios: audios,
        loading,
        filter,
        setFilter,
        fetchAudios: invalidate,
        createAudio,
        createAudioFromText,
        updateAudio,
        deleteAudio,
    }
}
