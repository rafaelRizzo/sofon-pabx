"use client"

import {
    CalendarDaysIcon,
    CalendarIcon,
    CalendarRangeIcon,
    PhoneOffIcon,
    PhoneIcon,
    type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { DashboardOverview } from "@/hooks/use-dashboard"

const TONE = {
    emerald: {
        chip: "bg-emerald-500/10 dark:bg-emerald-400/10",
        icon: "text-emerald-600 dark:text-emerald-400",
    },
    slate: {
        chip: "bg-slate-500/10 dark:bg-slate-400/10",
        icon: "text-slate-600 dark:text-slate-400",
    },
    blue: {
        chip: "bg-blue-500/10 dark:bg-blue-400/10",
        icon: "text-blue-600 dark:text-blue-400",
    },
    indigo: {
        chip: "bg-indigo-500/10 dark:bg-indigo-400/10",
        icon: "text-indigo-600 dark:text-indigo-400",
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

type Props = {
    overview: DashboardOverview | null
    loading: boolean
}

export function DashboardOverviewCards({ overview, loading }: Props) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile
                label="Ramais online"
                value={String(overview?.extensionsOnline ?? 0)}
                loading={loading}
                icon={PhoneIcon}
                tone="emerald"
            />
            <StatTile
                label="Ramais offline"
                value={String(overview?.extensionsOffline ?? 0)}
                loading={loading}
                icon={PhoneOffIcon}
                tone="slate"
            />
            <StatTile
                label="Chamadas hoje"
                value={String(overview?.callsToday ?? 0)}
                loading={loading}
                icon={CalendarIcon}
                tone="blue"
            />
            <StatTile
                label="Chamadas no mês"
                value={String(overview?.callsThisMonth ?? 0)}
                loading={loading}
                icon={CalendarRangeIcon}
                tone="indigo"
            />
            <StatTile
                label="Chamadas no ano"
                value={String(overview?.callsThisYear ?? 0)}
                loading={loading}
                icon={CalendarDaysIcon}
                tone="amber"
            />
        </div>
    )
}
