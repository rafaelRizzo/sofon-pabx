"use client"

import { useEffect, useState } from "react"

import { openEventStream } from "@/lib/sse"

// Espelha backend/src/modules/realtime/schemas/realtime.schema.ts. Os 3 hooks abaixo consomem SSE
// (GET /realtime/<recurso>/stream) em vez de polling: o backend empurra um snapshot novo só quando
// o AMI reporta mudança (ver ami-events.ts + realtime-bus.ts), não a cada N segundos.

export type Presence = "online" | "offline" | "unknown"
export type CallState =
    | "idle"
    | "ringing"
    | "in_call"
    | "busy"
    | "unavailable"
    | "unknown"

export type RealtimeActiveCall = {
    uniqueid: string
    callerNum: string
    startAt: number | null
    bridgedWith: string | null
    // tronco por onde a ligação entrou - null se for chamada interna ou par ainda não capturado
    trunkName: string | null
}

export type RealtimeExtension = {
    id: string
    alias: string
    number: string
    name: string
    type: string
    companyId: string
    presence: Presence
    callState: CallState
    activeCalls: RealtimeActiveCall[]
}

// Qualidade de rede por perna de canal - equivalente ao `pjsip show channelstats` do CLI, via
// RTCPSent/RTCPReceived nativo do Asterisk (ver handleRtcpStats em ami-events.ts, backend).
// Unidades de jitter são as nativas do RTP (timestamp units), não convertidas pra ms - o backend
// não tem o codec da chamada disponível nesse evento pra fazer a conversão correta.
export type RealtimeCallNetworkQuality = {
    rxJitterUnits: number | null
    rxLostPct: number | null
    txJitterUnits: number | null
    txLostPct: number | null
    rttSeconds: number | null
    updatedAt: number
}

export type RealtimeTrunkActiveCall = {
    uniqueid: string
    callerNum: string
    startAt: number | null
    // null enquanto o primeiro par de RTCP ainda não chegou (~5s após atender)
    network: RealtimeCallNetworkQuality | null
}

export type RealtimeTrunk = {
    id: string
    name: string
    companyId: string
    type: string
    registrationMode: string
    presence: Presence
    // Intervalo de registro configurado (segundos) - só existe pra troncos outbound com registro
    expirySeconds: number | null
    activeCalls: RealtimeTrunkActiveCall[]
}

export type RealtimeQueueMember = {
    extensionId: string
    number: string
    name: string
    penalty: number
    paused: boolean
    pauseReason: string | null
    status: CallState
}

export type RealtimeQueueWaitingCaller = {
    uniqueid: string
    callerNum: string
    waitingSeconds: number
}

export type RealtimeQueue = {
    id: string
    name: string
    number: string
    companyId: string
    calls: number
    // média de hoje calculada a partir do CDR (não o QueueParams.Holdtime ao vivo do AMI, que
    // zera sozinho quando a fila fica ociosa) - holdtimeSampleSize=0 é "sem chamada atendida
    // hoje ainda", não "média literalmente zero"
    holdtime: number
    holdtimeSampleSize: number
    members: RealtimeQueueMember[]
    waiting: RealtimeQueueWaitingCaller[]
}

export function useRealtimeExtensions(companyId?: string) {
    const [extensions, setExtensions] = useState<RealtimeExtension[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!companyId) {
            setExtensions([])
            setLoading(false)
            return
        }
        setLoading(true)
        return openEventStream<RealtimeExtension[]>({
            url: "/realtime/extensions/stream",
            params: { companyId },
            onMessage: (data) => {
                setExtensions(data ?? [])
                setLoading(false)
            },
        })
    }, [companyId])

    return { extensions, loading }
}

export function useRealtimeTrunks(companyId?: string) {
    const [trunks, setTrunks] = useState<RealtimeTrunk[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!companyId) {
            setTrunks([])
            setLoading(false)
            return
        }
        setLoading(true)
        return openEventStream<RealtimeTrunk[]>({
            url: "/realtime/trunks/stream",
            params: { companyId },
            onMessage: (data) => {
                setTrunks(data ?? [])
                setLoading(false)
            },
        })
    }, [companyId])

    return { trunks, loading }
}

export function useRealtimeQueues(companyId?: string) {
    const [queues, setQueues] = useState<RealtimeQueue[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!companyId) {
            setQueues([])
            setLoading(false)
            return
        }
        setLoading(true)
        return openEventStream<RealtimeQueue[]>({
            url: "/realtime/queues/stream",
            params: { companyId },
            onMessage: (data) => {
                setQueues(data ?? [])
                setLoading(false)
            },
        })
    }, [companyId])

    return { queues, loading }
}
