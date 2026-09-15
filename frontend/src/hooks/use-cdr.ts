"use client"

import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"

export type CdrDirection = "inbound" | "outbound" | "internal"

export type CdrCallStatus =
    | "ANSWERED"
    | "NO ANSWER"
    | "BUSY"
    | "FAILED"
    | "CONGESTION"

export type CdrRecord = {
    id: string
    src: string | null
    dst: string | null
    context: string | null
    callerid: string | null
    srcChannel: string | null
    dstChannel: string | null
    lastApp: string | null
    lastData: string | null
    startTime: string | null
    answerTime: string | null
    endTime: string | null
    duration: number | null
    billsec: number | null
    callStatus: string | null
    uniqueid: string | null
    queueName: string | null
    linkedid: string | null
    sequence: number | null
    direction: string | null
    originExtension: string | null
    dialedNumber: string | null
    trunkId: string | null
    // Só != trunkId quando a operadora entrega a ligação (direction=inbound) por um tronco de
    // empresa diferente da dona do DID - trunkId é o configurado na Inbound Route, entryTrunkId é
    // o que o Asterisk de fato identificou pra essa chamada. Só informativo (ver backend/CLAUDE.md)
    entryTrunkId: string | null
    recordingFile: string | null
    hangupCause: string | null
    // Resolvidos pelo backend em tempo de leitura (cdr-enrichment.ts) - cobrem chamadas roteadas
    // por Flow, onde queueName/direction/trunkId do dialplan nem sempre sobrevivem até o fim
    queueLabel: string | null
    destinationLabel: string | null
    answeredBy: { extensionId: string; label: string } | null
    // originExtension "cru" (CALLERID(num), formato <alias>_<asteriskId>) resolvido pro nome
    // amigável do ramal via join com Extension - null quando a origem é externa (chamada de entrada)
    originLabel: string | null
    // Tempo de espera na fila (até o agente atender) e tempo em ligação após atendida - vem do
    // QueueCall associado; null pra chamadas que não passaram por fila
    queueWaitSeconds: number | null
    queueTalkSeconds: number | null
}

// Últimas 100 chamadas do ramal do usuário logado (Painel do Agente) - sem companyId/paginação,
// o backend resolve tudo a partir do token (/cdr/me, ver cdr.service.ts:getMyRecentCalls)
export function useMyRecentCalls() {
    const { data: records = [], isLoading: loading } = useQuery({
        queryKey: ["cdr-me"],
        queryFn: async () => {
            const { data } = await api.get("/cdr/me")
            return (data.records ?? []) as CdrRecord[]
        },
    })

    return { records, loading }
}

export type CdrFilters = {
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    direction?: CdrDirection
    callStatus?: CdrCallStatus
    // originExtension: alias/número do ramal (CALLERID(num) setado via dialplan), não o id do registro Extension
    originExtension?: string
    // src/dst: colunas nativas do Asterisk, sempre preenchidas (diferente de originExtension/dialedNumber,
    // que só existem em chamadas que passaram pelo dialplan enriquecido)
    src?: string
    dst?: string
    trunkId?: string
    queueId?: string
    order?: "asc" | "desc"
}

const DEFAULT_LIMIT = 50

function filterParams(companyId: string, filters: CdrFilters, extra?: object) {
    return {
        companyId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        direction: filters.direction || undefined,
        callStatus: filters.callStatus || undefined,
        originExtension: filters.originExtension || undefined,
        src: filters.src || undefined,
        dst: filters.dst || undefined,
        trunkId: filters.trunkId || undefined,
        queueId: filters.queueId || undefined,
        order: filters.order ?? "desc",
        ...extra,
    }
}

// companyId é obrigatório na query do backend - sem opção de "todas as empresas" aqui
export function useCdrRecords(
    companyId?: string,
    filters: CdrFilters = {},
    limit = DEFAULT_LIMIT
) {
    const [page, setPage] = useState(1)

    const {
        startDate,
        endDate,
        direction,
        callStatus,
        originExtension,
        src,
        dst,
        trunkId,
        queueId,
        order,
    } = filters

    // qualquer mudança de filtro/empresa reseta a navegação para a 1ª página
    useEffect(() => {
        setPage(1)
    }, [
        companyId,
        startDate,
        endDate,
        direction,
        callStatus,
        originExtension,
        src,
        dst,
        trunkId,
        queueId,
        order,
    ])

    const { data, isLoading: loading } = useQuery({
        queryKey: ["cdr", companyId, filters, page, limit],
        queryFn: async () => {
            const { data } = await api.get("/cdr", {
                params: filterParams(companyId as string, filters, { page, limit }),
            })
            return {
                records: (data.records ?? []) as CdrRecord[],
                total: (data.total ?? 0) as number,
            }
        },
        enabled: !!companyId,
        placeholderData: keepPreviousData,
    })

    return {
        records: data?.records ?? [],
        total: data?.total ?? 0,
        limit,
        loading,
        page,
        totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
        goToPage: setPage,
    }
}

// Streaming CSV do backend (/cdr/export) - sem limite de linhas, sem carregar tudo em memória
// como objeto antes de gerar o CSV no client (ver cdr.controller.ts/exportCdr)
export async function downloadCdrExport(companyId: string, filters: CdrFilters = {}) {
    const res = await api.get("/cdr/export", {
        params: filterParams(companyId, filters),
        responseType: "blob",
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "cdr.csv"
    a.click()
    URL.revokeObjectURL(url)
}

export type CdrMetrics = {
    total: number
    answered: number
    answerRate: number
    totalDuration: number
    totalBillsec: number
    avgDuration: number | null
    avgBillsec: number | null
    byStatus: { callStatus: string | null; calls: number }[]
    byDirection: { direction: string | null; calls: number }[]
}

export function useCdrMetrics(companyId?: string, filters: CdrFilters = {}) {
    const { data: metrics = null, isLoading: loading } = useQuery({
        queryKey: ["cdr-metrics", companyId, filters],
        queryFn: async () => {
            const { data } = await api.get("/cdr/metrics", {
                params: filterParams(companyId as string, filters),
            })
            return (data.metrics ?? null) as CdrMetrics | null
        },
        enabled: !!companyId,
    })

    return { metrics, loading }
}

function extractFilename(disposition: unknown, fallback: string): string {
    if (typeof disposition !== "string") return fallback
    const match = disposition.match(/filename="?([^"]+)"?/)
    return match?.[1] ?? fallback
}

// Precisa ser via api.get (axios injeta o Bearer token no interceptor) e não <a href>/<audio src>
// direto - o backend autentica por header, não cookie de sessão, então uma URL pura não carrega nada
async function fetchCdrRecordingBlob(id: string, companyId: string) {
    const res = await api.get(`/cdr/${id}/recording`, {
        params: { companyId },
        responseType: "blob",
    })
    const filename = extractFilename(res.headers["content-disposition"], `cdr-${id}.wav`)
    return { url: URL.createObjectURL(res.data as Blob), filename }
}

export async function downloadCdrRecording(id: string, companyId: string) {
    const toastId = toast.loading("Baixando gravação...")
    try {
        const { url, filename } = await fetchCdrRecordingBlob(id, companyId)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Gravação baixada", { id: toastId })
    } catch (err) {
        toast.error(apiError(err, "Erro ao baixar gravação"), { id: toastId })
    }
}

// Retorna a blob URL pra tocar inline (<audio>) - chamador é responsável por revogar via
// URL.revokeObjectURL quando parar de usar
export async function loadCdrRecordingAudio(
    id: string,
    companyId: string
): Promise<string | null> {
    try {
        const { url } = await fetchCdrRecordingBlob(id, companyId)
        return url
    } catch (err) {
        toast.error(apiError(err, "Erro ao carregar gravação"))
        return null
    }
}
