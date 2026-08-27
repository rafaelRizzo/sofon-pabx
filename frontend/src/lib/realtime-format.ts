import type { RealtimeActiveCall } from "@/hooks/use-realtime"

// startAt vem em epoch ms; recalculado a cada render (a cada push do SSE isso já é atualizado)
export function formatElapsed(startAt: number | null): string {
    if (!startAt) return ""
    const seconds = Math.max(0, Math.round((Date.now() - startAt) / 1000))
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
}

export function activeCallLabel(activeCall: RealtimeActiveCall): string {
    const who = activeCall.callerNum || "-"
    const via = activeCall.trunkName ? ` via ${activeCall.trunkName}` : ""
    return `${who}${via} · há ${formatElapsed(activeCall.startAt)}`
}
