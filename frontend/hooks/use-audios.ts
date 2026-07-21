"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type Audio = {
    id: string
    name: string
    companyId: string
    createdAt: string
    updatedAt: string
}

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do upload
// (que é passada explicitamente para createAudio, pois pode divergir deste filtro)
export function useAudios(companyId?: string) {
    const [audios, setAudios] = useState<Audio[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchAudios = useCallback(async () => {
        if (!companyId) {
            setAudios([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/audios", { params: { companyId } })
            setAudios(data.audios ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar áudios"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

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
            await fetchAudios()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao enviar áudio"), { id })
            return false
        }
    }

    const updateAudio = async (audioId: string, name: string) => {
        const id = toast.loading("Renomeando áudio...")
        try {
            await api.patch(`/audios/${audioId}`, { name })
            toast.success("Áudio renomeado", { id })
            await fetchAudios()
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
            await fetchAudios()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar áudio"), { id })
            return false
        }
    }

    const filtered = audios.filter((a) =>
        a.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({
        fetched: false,
    })

    useEffect(() => {
        if (
            fetchStateRef.current.fetched &&
            fetchStateRef.current.key === companyId
        )
            return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchAudios()
    }, [fetchAudios, companyId])

    return {
        audios: filtered,
        allAudios: audios,
        loading,
        filter,
        setFilter,
        fetchAudios,
        createAudio,
        updateAudio,
        deleteAudio,
    }
}
