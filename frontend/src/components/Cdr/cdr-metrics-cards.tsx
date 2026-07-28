"use client"

import {
    PercentIcon,
    PhoneCallIcon,
    PhoneIcon,
    TimerIcon,
    type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { CdrMetrics } from "@/hooks/use-cdr"

const TONE = {
    blue: {
        chip: "bg-blue-500/10 dark:bg-blue-400/10",
        icon: "text-blue-600 dark:text-blue-400",
    },
    emerald: {
        chip: "bg-emerald-500/10 dark:bg-emerald-400/10",
        icon: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
        chip: "bg-amber-500/10 dark:bg-amber-400/10",
        icon: "text-amber-600 dark:text-amber-400",
    },
    violet: {
        chip: "bg-violet-500/10 dark:bg-violet-400/10",
        icon: "text-violet-600 dark:text-violet-400",
    },
} as const

function StatTile({
    label,
    value,
    loading,
    icon: Icon,
    tone,
}: {
    label: string
    value: string
    loading: boolean
    icon: LucideIcon
    tone: keyof typeof TONE
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
                        <Skeleton className="h-7 w-12" />
                    ) : (
                        <span className="font-mono text-2xl leading-none font-semibold tabular-nums">
                            {value}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

type Props = {
    metrics: CdrMetrics | null
    loading: boolean
}

export function CdrMetricsCards({ metrics, loading }: Props) {
    const answerRate = metrics ? Math.round(metrics.answerRate * 100) : 0

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
                label="Total de chamadas"
                value={String(metrics?.total ?? 0)}
                loading={loading}
                icon={PhoneIcon}
                tone="blue"
            />
            <StatTile
                label="Atendidas"
                value={String(metrics?.answered ?? 0)}
                loading={loading}
                icon={PhoneCallIcon}
                tone="emerald"
            />
            <StatTile
                label="Taxa de atendimento"
                value={`${answerRate}%`}
                loading={loading}
                icon={PercentIcon}
                tone="amber"
            />
            <StatTile
                label="Tempo médio de conversa"
                value={formatDuration(metrics?.avgBillsec ?? null)}
                loading={loading}
                icon={TimerIcon}
                tone="violet"
            />
        </div>
    )
}
