"use client"

import { useEffect, useState } from "react"

function formatElapsed(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const mm = String(minutes).padStart(2, "0")
    const ss = String(seconds).padStart(2, "0")
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

// Isolado num componente próprio pra o tick de 1s não re-renderizar o resto do
// painel/widget - só esse relógio pisca a cada segundo.
export function WebphoneCallTimer({ startedAt }: { startedAt: number }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])

    return (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatElapsed(now - startedAt)}
        </span>
    )
}
