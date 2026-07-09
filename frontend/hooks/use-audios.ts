"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

// Leitura apenas — CRUD completo (upload multipart, renomear, remover) fica pra quando a página
// de gerenciamento de áudios for construída. Por enquanto só serve pra popular selects que
// referenciam um áudio já cadastrado (ex: música de espera e anúncio periódico da fila).
export type Audio = {
    id: string
    name: string
    companyId: string
    createdAt: string
    updatedAt: string
}

export function useAudios(companyId?: string) {
    const [audios, setAudios] = useState<Audio[]>([])
    const [loading, setLoading] = useState(true)

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

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchAudios()
    }, [fetchAudios, companyId])

    return { audios, loading, fetchAudios }
}
