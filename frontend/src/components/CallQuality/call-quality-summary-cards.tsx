"use client"

import {
    ActivityIcon,
    PhoneIcon,
    SignalHighIcon,
    TimerIcon,
    type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { type CallQualitySummaryCardsProps } from "@/components/CallQuality/types"

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
    indigo: {
        chip: "bg-indigo-500/10 dark:bg-indigo-400/10",
        icon: "text-indigo-600 dark:text-indigo-400",
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
        <Card size="sm" className="border border-input ring-0 dark:border-[#383838]">
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
                    <CardDescription className="truncate">{label}</CardDescription>
                    {loading ? (
                        <Skeleton className="h-7 w-14" />
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

function fmt(value: number | null, digits: number, suffix = ""): string {
    if (value == null) return "-"
    return `${value.toFixed(digits)}${suffix}`
}

// Unidades de jitter são as nativas do RTP (timestamp units), não ms - o backend não converte
// (não tem o codec da chamada disponível no evento RTCP) - ver use-call-quality.ts
export function CallQualitySummaryCards({ summary, loading }: CallQualitySummaryCardsProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile
                label="Chamadas no período"
                value={String(summary?.totalCalls ?? 0)}
                loading={loading}
                icon={PhoneIcon}
                tone="blue"
            />
            <StatTile
                label="Jitter médio (RX)"
                value={fmt(summary?.avgRxJitterUnits ?? null, 1)}
                loading={loading}
                icon={ActivityIcon}
                tone="emerald"
            />
            <StatTile
                label="Perda média (RX)"
                value={fmt(summary?.avgRxLostPct ?? null, 2, "%")}
                loading={loading}
                icon={SignalHighIcon}
                tone="amber"
            />
            <StatTile
                label="Jitter médio (TX)"
                value={fmt(summary?.avgTxJitterUnits ?? null, 1)}
                loading={loading}
                icon={ActivityIcon}
                tone="indigo"
            />
            <StatTile
                label="RTT médio"
                value={fmt(summary?.avgRttSeconds ?? null, 4, "s")}
                loading={loading}
                icon={TimerIcon}
                tone="blue"
            />
        </div>
    )
}
