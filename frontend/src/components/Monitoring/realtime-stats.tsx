"use client"

import { Clock, Phone, PhoneCall, type LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { LiveDot } from "@/components/Monitoring/live-indicator"
import type { RealtimeExtension, RealtimeQueue } from "@/hooks/use-realtime"

type Props = {
    extensions: RealtimeExtension[]
    queues: RealtimeQueue[]
    loading: boolean
}

const TONE = {
    emerald: {
        chip: "bg-emerald-500/10 dark:bg-emerald-400/10",
        icon: "text-emerald-600 dark:text-emerald-400",
    },
    blue: {
        chip: "bg-blue-500/10 dark:bg-blue-400/10",
        icon: "text-blue-600 dark:text-blue-400",
    },
    amber: {
        chip: "bg-amber-500/10 dark:bg-amber-400/10",
        icon: "text-amber-600 dark:text-amber-400",
    },
} as const

function StatTile({
    label,
    value,
    loading,
    icon: Icon,
    tone,
    urgent,
}: {
    label: string
    value: number
    loading: boolean
    icon: LucideIcon
    tone: keyof typeof TONE
    // pulso reservado pra métrica que exige ação humana agora (espera > 0) — as outras duas
    // ficam quietas, senão a tela inteira pisca e o pulso perde o significado
    urgent?: boolean
}) {
    const style = TONE[tone]

    return (
        <Card size="sm">
            <CardContent className="flex items-center gap-3">
                <div
                    className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        style.chip
                    )}
                >
                    <Icon className={cn("size-4", style.icon)} />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <CardDescription className="truncate">
                        {label}
                    </CardDescription>
                    {loading ? (
                        <Skeleton className="h-7 w-8" />
                    ) : (
                        <span className="flex items-center gap-2 font-mono text-2xl leading-none font-semibold tabular-nums">
                            {value}
                            {urgent && <LiveDot />}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// Derivado só do que já está na tela (extensions/queues do SSE) — sem request adicional.
// "Em andamento" conta só callState "in_call" (atendida/bridged) — NÃO inclui "ringing": no
// Asterisk o caller continua em queue.waiting até atender ou desligar, então enquanto toca no
// ramal ele já está em "espera" (ver Filas). Contar ringing aqui também somaria a mesma chamada
// duas vezes (1 tocando apareceria como 1 em andamento + 1 em espera ao mesmo tempo).
export function RealtimeStats({ extensions, queues, loading }: Props) {
    const idleCount = extensions.filter((e) => e.callState === "idle").length
    const inCallCount = extensions.filter(
        (e) => e.callState === "in_call"
    ).length
    const waitingCount = queues.reduce((sum, q) => sum + q.waiting.length, 0)

    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
                label="Ramais livres"
                value={idleCount}
                loading={loading}
                icon={Phone}
                tone="emerald"
            />
            <StatTile
                label="Chamadas em andamento"
                value={inCallCount}
                loading={loading}
                icon={PhoneCall}
                tone="blue"
            />
            <StatTile
                label="Chamadas em espera"
                value={waitingCount}
                loading={loading}
                icon={Clock}
                tone="amber"
                urgent={!loading && waitingCount > 0}
            />
        </div>
    )
}
