"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

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
    ringall:
        "Toca em todos os ramais livres ao mesmo tempo; atende quem atender primeiro.",
    leastrecent:
        "Prioriza o ramal que está há mais tempo sem receber uma chamada da fila.",
    fewestcalls: "Prioriza o ramal que já atendeu o menor número de chamadas.",
    random: "Escolhe um ramal aleatório entre os disponíveis.",
    rrmemory:
        "Round robin com memória: distribui em sequência lembrando a última posição entre chamadas.",
    linear: "Sempre tenta os ramais na ordem em que foram cadastrados na fila.",
    wrandom:
        "Aleatório, mas pondera a chance de cada ramal conforme sua penalidade.",
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
    // Anúncio tocado uma única vez pro cliente ao entrar na fila ("join announcement")
    announce: string | null
    announceFrequency: number
    announcePosition: boolean
    periodicAnnounce: string | null
    periodicAnnounceFrequency: number
    // Anúncio tocado pro atendente bem antes de a ligação ser conectada ("agent announcement")
    agentAnnounce: string | null
    weight: number
    joinEmpty: boolean
    leaveWhenEmpty: boolean
    // não é mais editável por aqui - só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantido no tipo só porque a
    // API ainda devolve o campo (label resolvido, usado em telas de leitura)
    postQueueDestination: RouteDestination
    usedBy: UsedByRef[]
    // Pesquisa de satisfação pós-atendimento (módulo callcenter), 2 perguntas: surveyAudioId
    // (atendimento) e surveyServiceAudioId (serviço contratado) - hasSurveyAudio é derivado (true
    // só quando os dois estão setados, ver backend/queues.service.ts)
    surveyAudioId: string | null
    surveyServiceAudioId: string | null
    // Áudio de agradecimento tocado ao final da pesquisa, depois da pergunta 2 - independente e
    // opcional, não entra na regra all-or-nothing das 2 perguntas acima
    surveyThanksAudioId: string | null
    hasSurveyAudio: boolean
    // Liga, só nessa fila, prioridade dinâmica (RoutingRule) e roteamento por afinidade (penalty) -
    // motor opcional do módulo Callcenter (regras/notas configuradas por empresa em /dashboard/callcenter)
    callcenterEnabled: boolean
    createdAt: string
    updatedAt: string
}

// Campos numéricos com default no backend - string vazia (campo limpo pelo usuário) cai no
// default em vez de virar inválido
const intWithDefault = (min: number, max: number, def: number) =>
    z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? def : Number(v)),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

// Espelha create/updateQueueSchema de backend/src/modules/queues/schemas/queue.schema.ts -
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
    // Sem gestão de classes de MOH no Asterisk ainda - sempre "default" (única classe configurada)
    musicOnHold: z.string().min(1).max(128).default("default"),
    timeout: intWithDefault(1, 300, 15),
    retry: intWithDefault(1, 300, 5),
    maxLen: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    wrapupTime: intWithDefault(0, Number.MAX_SAFE_INTEGER, 5),
    // Anúncio tocado uma única vez ao entrar na fila (id de um Audio, ou null pra nenhum)
    announce: z.string().nullable(),
    // Frequência/toggle do "diz sua posição na fila" - announceFrequency só faz efeito com
    // announcePosition=true
    announceFrequency: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    announcePosition: z.boolean().default(false),
    // Mensagem repetida periodicamente durante a espera - diferente do announce acima
    periodicAnnounce: z.string().nullable(),
    periodicAnnounceFrequency: intWithDefault(0, Number.MAX_SAFE_INTEGER, 60),
    // Anúncio tocado pro atendente antes do bridge - diferente do announce (que é pro cliente)
    agentAnnounce: z.string().nullable(),
    joinEmpty: z.boolean().default(true),
    leaveWhenEmpty: z.boolean().default(false),
    weight: intWithDefault(0, Number.MAX_SAFE_INTEGER, 0),
    // Pesquisa de satisfação pós-atendimento, 2 perguntas (null nos dois = pesquisa desligada) -
    // backend valida all-or-nothing (os 2 juntos ou nenhum)
    surveyAudioId: z.string().nullable(),
    surveyServiceAudioId: z.string().nullable(),
    // Áudio de agradecimento tocado ao final da pesquisa - independente, não entra na regra
    // all-or-nothing acima
    surveyThanksAudioId: z.string().nullable(),
    // Liga o motor Callcenter (prioridade dinâmica + afinidade) só nessa fila
    callcenterEnabled: z.boolean().default(false),
}

// Pesquisa de satisfação é all-or-nothing: os 2 áudios juntos ou nenhum (mesma regra validada no
// backend, ver QueuesService) - reforçado aqui só pra evitar o round-trip de erro 400
const surveyAudiosRefinement = (data: {
    surveyAudioId: string | null
    surveyServiceAudioId: string | null
}) => (data.surveyAudioId !== null) === (data.surveyServiceAudioId !== null)
const surveyAudiosRefinementOptions = {
    message: "Preencha as 2 perguntas da pesquisa ou deixe as 2 vazias",
    path: ["surveyServiceAudioId"],
}

export const createQueueFormSchema = z
    .object({
        companyId: z.string().min(1, "Selecione uma empresa"),
        ...baseQueueFields,
    })
    .refine(surveyAudiosRefinement, surveyAudiosRefinementOptions)

export const updateQueueFormSchema = z
    .object(baseQueueFields)
    .refine(surveyAudiosRefinement, surveyAudiosRefinementOptions)

export type QueueForm = z.infer<typeof createQueueFormSchema>
export type QueueUpdateForm = z.infer<typeof updateQueueFormSchema>

// DTO de criação a partir do registro salvo (sem companyId - recriação sempre usa a empresa do
// flow) - usado pelo histórico de undo/redo do Flow pra recriar o recurso quando o usuário desfaz
// uma exclusão (ver flow-canvas.tsx)
export function toQueueCreationDto(queue: Queue): QueueUpdateForm {
    return {
        name: queue.name,
        number: queue.number,
        strategy: queue.strategy,
        musicOnHold: queue.musicOnHold,
        timeout: queue.timeout,
        retry: queue.retry,
        maxLen: queue.maxLen,
        wrapupTime: queue.wrapupTime,
        announce: queue.announce,
        announceFrequency: queue.announceFrequency,
        announcePosition: queue.announcePosition,
        periodicAnnounce: queue.periodicAnnounce,
        periodicAnnounceFrequency: queue.periodicAnnounceFrequency,
        agentAnnounce: queue.agentAnnounce,
        joinEmpty: queue.joinEmpty,
        leaveWhenEmpty: queue.leaveWhenEmpty,
        weight: queue.weight,
        surveyAudioId: queue.surveyAudioId,
        surveyServiceAudioId: queue.surveyServiceAudioId,
        surveyThanksAudioId: queue.surveyThanksAudioId,
        callcenterEnabled: queue.callcenterEnabled,
    }
}

async function fetchQueuesRequest(companyId: string): Promise<Queue[]> {
    const { data } = await api.get("/queues", { params: { companyId } })
    return data.queues ?? []
}

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useQueues(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: queues = [], isLoading: loading } = useQuery({
        queryKey: ["queues", companyId],
        queryFn: () => fetchQueuesRequest(companyId as string),
        enabled: !!companyId,
    })

    // invalida qualquer instância de useQueues montada (ex: page.tsx e o dialog do
    // Flow ao mesmo tempo), não só a lista chamada localmente - ganho sobre o
    // fetchQueues() manual anterior, que só atualizava a própria instância do hook
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["queues"] })

    const createMutation = useMutation({
        mutationFn: async (form: QueueForm) => {
            const { data } = await api.post("/queues", form)
            return data
        },
    })

    // companyId da fila vem do próprio form (campo "Empresa" do dialog), não do filtro da página -
    // permite criar uma fila pra empresa X enquanto a tabela lista a empresa Y
    async function createQueue(form: QueueForm): Promise<boolean>
    async function createQueue(
        form: QueueForm,
        withResourceId: true
    ): Promise<string | null>
    async function createQueue(form: QueueForm, withResourceId = false) {
        const id = toast.loading("Criando fila...")
        try {
            const data = await createMutation.mutateAsync(form)
            toast.success("Fila criada", { id })
            await invalidate()
            return withResourceId ? (data.queueId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar fila"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            queueId,
            form,
        }: {
            queueId: string
            form: QueueUpdateForm
        }) => api.put(`/queues/${queueId}`, form),
    })

    const updateQueue = async (queueId: string, form: QueueUpdateForm) => {
        const id = toast.loading("Atualizando fila...")
        try {
            await updateMutation.mutateAsync({ queueId, form })
            toast.success("Fila atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar fila"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (queueId: string) => api.delete(`/queues/${queueId}`),
    })

    const deleteQueue = async (queueId: string) => {
        const id = toast.loading("Deletando fila...")
        try {
            await deleteMutation.mutateAsync(queueId)
            toast.success("Fila deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar fila"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            queues.filter((q) =>
                `${q.name} ${q.number}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            ),
        [queues, filter]
    )

    return {
        queues: filtered,
        loading,
        filter,
        setFilter,
        fetchQueues: invalidate,
        createQueue,
        updateQueue,
        deleteQueue,
    }
}
