"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import {
    routeDestinationSchema,
    type RouteDestination,
} from "@/components/RouteDestination/route-destination-field"

export const QUEUE_STRATEGIES = [
    "ringall",
    "leastrecent",
    "fewestcalls",
    "random",
    "rrmemory",
    "linear",
    "wrandom",
] as const

export type QueueStrategy = (typeof QUEUE_STRATEGIES)[number]

export const QUEUE_STRATEGY_LABELS: Record<QueueStrategy, string> = {
    ringall: "Tocar em todos",
    leastrecent: "Menos recente",
    fewestcalls: "Menos chamadas",
    random: "Aleatório",
    rrmemory: "Round robin (memória)",
    linear: "Linear",
    wrandom: "Aleatório ponderado",
}

export const QUEUE_STRATEGY_DESCRIPTIONS: Record<QueueStrategy, string> = {
    ringall: "Toca em todos os ramais livres ao mesmo tempo; atende quem atender primeiro.",
    leastrecent: "Prioriza o ramal que está há mais tempo sem receber uma chamada da fila.",
    fewestcalls: "Prioriza o ramal que já atendeu o menor número de chamadas.",
    random: "Escolhe um ramal aleatório entre os disponíveis.",
    rrmemory: "Round robin com memória: distribui em sequência lembrando a última posição entre chamadas.",
    linear: "Sempre tenta os ramais na ordem em que foram cadastrados na fila.",
    wrandom: "Aleatório, mas pondera a chance de cada ramal conforme sua penalidade.",
}

export type Queue = {
    id: string
    name: string
    number: string
    companyId: string
    strategy: QueueStrategy
    musicOnHold: string
    timeout: number
    retry: number
    maxLen: number
    wrapupTime: number
    announce: string | null
    announceFrequency: number
    announcePosition: boolean
    periodicAnnounce: string | null
    periodicAnnounceFrequency: number
    weight: number
    joinEmpty: boolean
    leaveWhenEmpty: boolean
    postQueueDestination: RouteDestination
    createdAt: string
    updatedAt: string
}

// Campos numéricos com default no backend — string vazia (campo limpo pelo usuário) cai no
// default em vez de virar inválido
const intWithDefault = (min: number, max: number, def: number) =>
    z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? def : Number(v)),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

// Espelha create/updateQueueSchema de backend/src/modules/queues/schemas/queue.schema.ts —
// companyId só existe no create, o PUT do backend não permite trocar a empresa da fila
const baseQueueFields = {
    name: z
        .string()
        .min(1, "Informe o nome")
        .max(80, "Máximo 80 caracteres")
        .regex(/^[a-z0-9_-]+$/i, "Apenas letras, números, - e _"),
    number: z
        .string()
        .min(1, "Informe o número")
        .max(20, "Máximo 20 caracteres")
        .regex(/^\d+$/, "Apenas dígitos"),
    strategy: z.enum(QUEUE_STRATEGIES).default("ringall"),
    // Sem gestão de classes de MOH no Asterisk ainda — sempre "default" (única classe configurada)
    musicOnHold: z.string().min(1).max(128).default("default"),
    timeout: intWithDefault(1, 300, 15),
    retry: intWithDefault(1, 300, 5),
    maxLen: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    wrapupTime: intWithDefault(0, Number.MAX_SAFE_INTEGER, 5),
    // Anúncio tocado uma única vez ao entrar na fila (id de um Audio, ou null pra nenhum)
    announce: z.string().nullable(),
    // Frequência/toggle do "diz sua posição na fila" — announceFrequency só faz efeito com
    // announcePosition=true
    announceFrequency: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    announcePosition: z.boolean().default(false),
    // Mensagem repetida periodicamente durante a espera — diferente do announce acima
    periodicAnnounce: z.string().nullable(),
    periodicAnnounceFrequency: intWithDefault(0, Number.MAX_SAFE_INTEGER, 60),
    joinEmpty: z.boolean().default(true),
    leaveWhenEmpty: z.boolean().default(false),
    weight: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    postQueueDestination: routeDestinationSchema,
}

export const createQueueFormSchema = z.object({
    companyId: z.string().min(1, "Selecione uma empresa"),
    ...baseQueueFields,
})

export const updateQueueFormSchema = z.object(baseQueueFields)

export type QueueForm = z.infer<typeof createQueueFormSchema>
export type QueueUpdateForm = z.infer<typeof updateQueueFormSchema>

// companyId opcional — omitido, busca todas as filas no escopo do usuário (igual
// use-dids/use-extensions), permitindo o filtro "Todas as empresas" na página
export function useQueues(companyId?: string) {
    const [queues, setQueues] = useState<Queue[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchQueues = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/queues", {
                params: companyId ? { companyId } : undefined,
            })
            setQueues(data.queues ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar filas"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId da fila vem do próprio form (campo "Empresa" do dialog), não do filtro da página —
    // permite criar uma fila pra empresa X enquanto a tabela lista a empresa Y
    const createQueue = async (form: QueueForm) => {
        const id = toast.loading("Criando fila...")
        try {
            await api.post("/queues", form)
            toast.success("Fila criada", { id })
            await fetchQueues()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar fila"), { id })
            return false
        }
    }

    const updateQueue = async (queueId: string, form: QueueUpdateForm) => {
        const id = toast.loading("Atualizando fila...")
        try {
            await api.put(`/queues/${queueId}`, form)
            toast.success("Fila atualizada", { id })
            await fetchQueues()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar fila"), { id })
            return false
        }
    }

    const deleteQueue = async (queueId: string) => {
        const id = toast.loading("Deletando fila...")
        try {
            await api.delete(`/queues/${queueId}`)
            toast.success("Fila deletada", { id })
            await fetchQueues()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar fila"), { id })
            return false
        }
    }

    const filtered = queues.filter((q) =>
        `${q.name} ${q.number}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchQueues()
    }, [fetchQueues, companyId])

    return {
        queues: filtered,
        loading,
        filter,
        setFilter,
        fetchQueues,
        createQueue,
        updateQueue,
        deleteQueue,
    }
}
