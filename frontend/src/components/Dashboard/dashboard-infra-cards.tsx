"use client"

import {
    ArrowDownIcon,
    ArrowUpIcon,
    ClockIcon,
    CpuIcon,
    FileTextIcon,
    HardDriveIcon,
    MicIcon,
    MemoryStickIcon,
    NetworkIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { DashboardInfra } from "@/hooks/use-dashboard"

function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB", "TB"]
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

// > 85% já é digno de nota (disco/memória apertando) - mesmo critério de destaque usado em
// outros lugares do dashboard (jitter/perda de qualidade de rede)
function usagePctClass(pct: number): string {
    if (pct >= 0.85) return "text-red-600 dark:text-red-400"
    if (pct >= 0.7) return "text-amber-600 dark:text-amber-400"
    return ""
}

function UsageBar({ pct }: { pct: number }) {
    const clamped = Math.max(0, Math.min(1, pct))
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
                className={cn(
                    "h-full rounded-full",
                    clamped >= 0.85
                        ? "bg-red-500"
                        : clamped >= 0.7
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                )}
                style={{ width: `${clamped * 100}%` }}
            />
        </div>
    )
}

function InfraTile({
    label,
    icon: Icon,
    loading,
    children,
}: {
    label: string
    icon: typeof CpuIcon
    loading: boolean
    children: React.ReactNode
}) {
    return (
        <Card size="sm" className="border border-input ring-0 dark:border-[#383838]">
            <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-10 w-full" /> : children}
            </CardContent>
        </Card>
    )
}

type Props = {
    infra: DashboardInfra | null
    loading: boolean
}

export function DashboardInfraCards({ infra, loading }: Props) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <InfraTile label="CPU" icon={CpuIcon} loading={loading}>
                <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl font-semibold tabular-nums">
                        {infra?.cpu.loadAvg1.toFixed(2) ?? "-"}
                    </span>
                    <CardDescription>{infra?.cpu.cores ?? 0} núcleos</CardDescription>
                </div>
                <CardDescription className="mt-1">
                    load avg 5m {infra?.cpu.loadAvg5.toFixed(2) ?? "-"} · 15m{" "}
                    {infra?.cpu.loadAvg15.toFixed(2) ?? "-"}
                </CardDescription>
                {infra && infra.cpu.perCoreUsedPct.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-1">
                        {infra.cpu.perCoreUsedPct.map((pct, i) => (
                            <div
                                key={i}
                                className="flex flex-col gap-0.5 rounded bg-muted px-1.5 py-1"
                            >
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>C{i + 1}</span>
                                    <span
                                        className={cn(
                                            "font-mono tabular-nums",
                                            usagePctClass(pct)
                                        )}
                                    >
                                        {Math.round(pct * 100)}%
                                    </span>
                                </div>
                                <UsageBar pct={pct} />
                            </div>
                        ))}
                    </div>
                )}
            </InfraTile>

            <InfraTile label="Memória" icon={MemoryStickIcon} loading={loading}>
                <div className="flex items-baseline justify-between">
                    <span
                        className={cn(
                            "font-mono text-xl font-semibold tabular-nums",
                            usagePctClass(infra?.memory.usedPct ?? 0)
                        )}
                    >
                        {infra ? `${Math.round(infra.memory.usedPct * 100)}%` : "-"}
                    </span>
                    <CardDescription>
                        {infra ? formatBytes(infra.memory.totalBytes) : "-"}
                    </CardDescription>
                </div>
                <UsageBar pct={infra?.memory.usedPct ?? 0} />
            </InfraTile>

            <InfraTile label="Disco" icon={HardDriveIcon} loading={loading}>
                <div className="flex items-baseline justify-between">
                    <span
                        className={cn(
                            "font-mono text-xl font-semibold tabular-nums",
                            usagePctClass(infra?.disk.usedPct ?? 0)
                        )}
                    >
                        {infra ? `${Math.round(infra.disk.usedPct * 100)}%` : "-"}
                    </span>
                    <CardDescription>
                        {infra ? formatBytes(infra.disk.totalBytes) : "-"}
                    </CardDescription>
                </div>
                <UsageBar pct={infra?.disk.usedPct ?? 0} />
            </InfraTile>

            <InfraTile label="Gravações" icon={MicIcon} loading={loading}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatBytes(infra.recordings.sizeBytes) : "-"}
                </span>
                <CardDescription className="mt-1">
                    Total em /var/spool/asterisk/monitor
                </CardDescription>
            </InfraTile>

            <InfraTile label="Logs" icon={FileTextIcon} loading={loading}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatBytes(infra.logs.sizeBytes) : "-"}
                </span>
                <CardDescription className="mt-1">
                    Total em /var/log/asterisk
                </CardDescription>
            </InfraTile>

            <InfraTile label="Uptime" icon={ClockIcon} loading={loading}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatUptime(infra.uptimeSeconds) : "-"}
                </span>
                <CardDescription className="mt-1">Desde o último restart</CardDescription>
            </InfraTile>

            <InfraTile label="Rede" icon={NetworkIcon} loading={loading}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <ArrowDownIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-mono text-sm font-semibold tabular-nums">
                            {infra ? `${formatBytes(infra.network.rxBytesPerSec)}/s` : "-"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ArrowUpIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="font-mono text-sm font-semibold tabular-nums">
                            {infra ? `${formatBytes(infra.network.txBytesPerSec)}/s` : "-"}
                        </span>
                    </div>
                </div>
                <CardDescription className="mt-1">Entrada · Saída</CardDescription>
            </InfraTile>
        </div>
    )
}
