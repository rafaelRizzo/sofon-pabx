"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type RegistrationMode = "outbound" | "inbound"

export type IdentifyBy = "ip" | "username"

export type Trunk = {
    id: string
    name: string
    companyId: string
    registrationMode: RegistrationMode
    // Derivado pelo backend a partir de username (inbound: "username" se informado, senão "ip"; outbound: sempre null)
    // — não é enviado no create/update; no PUT inbound, enviar username muda para "username", enviar username: null volta para "ip"
    identifyBy: IdentifyBy | null
    host: string | null
    port: number | null
    username: string | null
    password: string | null
    context: string
    codecs: string
    maxInChannels: number | null
    maxOutChannels: number | null
    createdAt: string
    updatedAt: string
}

const optChannels = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1, "Mínimo 1").optional()
)

const optPort = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1, "Mínimo 1").max(65535, "Máximo 65535").optional()
)

// Espelha baseTrunkShape de backend/src/modules/trunks/schemas/trunk.schema.ts
const baseTrunkFields = {
    name: z
        .string()
        .min(1, "Informe o nome")
        .max(20, "Máximo 20 caracteres")
        .regex(/^[a-z0-9_-]+$/i, "Apenas letras, números, - e _"),
    companyId: z.string().min(1, "Selecione a empresa"),
    codecs: z.string().max(200).default("ulaw,alaw"),
    maxInChannels: optChannels,
    maxOutChannels: optChannels,
    port: optPort,
}

export const createTrunkSchema = z.discriminatedUnion("registrationMode", [
    z.object({
        ...baseTrunkFields,
        registrationMode: z.literal("outbound"),
        host: z.string().min(1, "Informe o host").max(255),
        username: z.string().min(1, "Informe o usuário").max(80),
        password: z.string().min(1, "Informe a senha").max(80),
    }),
    z.object({
        ...baseTrunkFields,
        registrationMode: z.literal("inbound"),
        host: z.string().max(255).optional(),
        username: z.string().max(80).optional(),
        password: z.string().max(80).optional(),
    }),
])

export const updateTrunkSchema = z.object({
    host: z.string().max(255).optional(),
    port: optPort,
    username: z.string().max(80).optional(),
    password: z.string().max(80).optional(),
    codecs: z.string().max(200).optional(),
    maxInChannels: optChannels,
    maxOutChannels: optChannels,
})

export type TrunkCreateForm = z.infer<typeof createTrunkSchema>
export type TrunkUpdateForm = z.infer<typeof updateTrunkSchema>

// companyId opcional — omitido, busca todos os troncos no escopo do usuário, permitindo o
// filtro "Todas as empresas" na página
export function useTrunks(companyId?: string) {
    const [trunks, setTrunks] = useState<Trunk[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchTrunks = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/trunks", {
                params: companyId ? { companyId } : undefined,
            })
            setTrunks(data.trunks ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar troncos"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createTrunk = async (form: TrunkCreateForm): Promise<Trunk | null> => {
        const id = toast.loading("Criando tronco...")
        try {
            // Campos opcionais (host/username/password no inbound) exigem
            // min(1) no backend quando informados — "" precisa virar omissão
            const payload = Object.fromEntries(
                Object.entries(form).filter(([, v]) => v !== undefined && v !== "")
            )
            const { data } = await api.post("/trunks", payload)
            toast.success("Tronco criado", { id })
            await fetchTrunks()
            return data.trunk ?? null
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar tronco"), { id })
            return null
        }
    }

    const updateTrunk = async (trunkId: string, form: TrunkUpdateForm) => {
        const id = toast.loading("Atualizando tronco...")
        try {
            const payload = Object.fromEntries(
                Object.entries(form).filter(([, v]) => v !== undefined && v !== "")
            )
            await api.put(`/trunks/${trunkId}`, payload)
            toast.success("Tronco atualizado", { id })
            await fetchTrunks()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar tronco"), { id })
            return false
        }
    }

    const deleteTrunk = async (trunkId: string) => {
        const id = toast.loading("Deletando tronco...")
        try {
            await api.delete(`/trunks/${trunkId}`)
            toast.success("Tronco deletado", { id })
            await fetchTrunks()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar tronco"), { id })
            return false
        }
    }

    const filtered = trunks.filter((t) =>
        `${t.name} ${t.host ?? ""}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchTrunks()
    }, [fetchTrunks, companyId])

    return {
        trunks: filtered,
        loading,
        filter,
        setFilter,
        fetchTrunks,
        createTrunk,
        updateTrunk,
        deleteTrunk,
    }
}
