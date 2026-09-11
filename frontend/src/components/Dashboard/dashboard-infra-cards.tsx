"use client"

import {
    ActivityIcon,
    ArrowDownIcon,
    ArrowLeftRightIcon,
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
import { type DashboardInfraCardsProps } from "@/components/Dashboard/types"

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

// Escala de alerta em 3 níveis: >= 50% amarelo, >= 70% laranja, >= 85% vermelho -
// mesmo critério de destaque usado em outros lugares do dashboard (jitter/perda de qualidade de rede)
function usagePctClass(pct: number): string {
    if (pct >= 0.85) return "text-red-600 dark:text-red-400"
    if (pct >= 0.7) return "text-orange-600 dark:text-orange-400"
    if (pct >= 0.5) return "text-yellow-600 dark:text-yellow-400"
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
                          ? "bg-orange-500"
                          : clamped >= 0.5
                            ? "bg-yellow-500"
                            : "bg-emerald-500"
                )}
                style={{ width: `${clamped * 100}%` }}
            />
        </div>
    )
}

// Cada variante espelha o formato real do conteúdo do tile (valor + descrição, com ou sem barra/
// grid) - skeleton genérico (1 retângulo) não passava a forma do dado que está carregando
function StatSkeleton() {
    return (
        <div className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
        </div>
    )
}

function BarStatSkeleton() {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
    )
}

function CpuSkeleton() {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-40" />
            <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded" />
                ))}
            </div>
        </div>
    )
}

function NetworkSkeleton() {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-24" />
        </div>
    )
}

function TopProcessesSkeleton() {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-24" />
                </div>
            ))}
        </div>
    )
}

function InfraTile({
    label,
    icon: Icon,
    loading,
    skeleton,
    children,
    className,
}: {
    label: string
    icon: typeof CpuIcon
    loading: boolean
    skeleton: React.ReactNode
    children: React.ReactNode
    className?: string
}) {
    return (
        <Card
            size="sm"
            className={cn("border border-input ring-0 dark:border-[#383838]", className)}
        >
            <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>{loading ? skeleton : children}</CardContent>
        </Card>
    )
}

export function DashboardInfraCards({
    infra,
    loading,
}: DashboardInfraCardsProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfraTile label="CPU" icon={CpuIcon} loading={loading} skeleton={<CpuSkeleton />}>
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

            <InfraTile label="Memória" icon={MemoryStickIcon} loading={loading} skeleton={<BarStatSkeleton />}>
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

            <InfraTile label="Swap" icon={ArrowLeftRightIcon} loading={loading} skeleton={<BarStatSkeleton />}>
                {infra && infra.swap.totalBytes === 0 ? (
                    <CardDescription>Sem swap configurado</CardDescription>
                ) : (
                    <>
                        <div className="flex items-baseline justify-between">
                            <span
                                className={cn(
                                    "font-mono text-xl font-semibold tabular-nums",
                                    usagePctClass(infra?.swap.usedPct ?? 0)
                                )}
                            >
                                {infra ? `${Math.round(infra.swap.usedPct * 100)}%` : "-"}
                            </span>
                            <CardDescription>
                                {infra ? formatBytes(infra.swap.totalBytes) : "-"}
                            </CardDescription>
                        </div>
                        <UsageBar pct={infra?.swap.usedPct ?? 0} />
                    </>
                )}
            </InfraTile>

            <InfraTile label="Disco" icon={HardDriveIcon} loading={loading} skeleton={<BarStatSkeleton />}>
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

            <InfraTile label="Gravações" icon={MicIcon} loading={loading} skeleton={<StatSkeleton />}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatBytes(infra.recordings.sizeBytes) : "-"}
                </span>
                <CardDescription className="mt-1">
                    Total em /var/spool/asterisk/monitor
                </CardDescription>
            </InfraTile>

            <InfraTile label="Logs" icon={FileTextIcon} loading={loading} skeleton={<StatSkeleton />}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatBytes(infra.logs.sizeBytes) : "-"}
                </span>
                <CardDescription className="mt-1">
                    Total em /var/log/asterisk
                </CardDescription>
            </InfraTile>

            <InfraTile label="Uptime" icon={ClockIcon} loading={loading} skeleton={<StatSkeleton />}>
                <span className="font-mono text-xl font-semibold tabular-nums">
                    {infra ? formatUptime(infra.uptimeSeconds) : "-"}
                </span>
                <CardDescription className="mt-1">Desde o último restart</CardDescription>
            </InfraTile>

            <InfraTile
                label="Processos"
                icon={ActivityIcon}
                loading={loading}
                skeleton={<TopProcessesSkeleton />}
                className="lg:col-span-2"
            >
                <div className="flex flex-col gap-1.5">
                    {infra && infra.topProcesses.length === 0 && (
                        <CardDescription>Dado indisponível</CardDescription>
                    )}
                    {infra?.topProcesses.map((p) => (
                        <div key={p.pid} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{p.name}</span>
                            <div className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                                <span className={cn("w-14 text-right", usagePctClass(p.cpuPct))}>
                                    {Math.round(p.cpuPct * 100)}% cpu
                                </span>
                                <span className={cn("w-14 text-right", usagePctClass(p.memPct))}>
                                    {Math.round(p.memPct * 100)}% mem
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </InfraTile>

            <InfraTile
                label="Rede (backend)"
                icon={NetworkIcon}
                loading={loading}
                skeleton={<NetworkSkeleton />}
                className="sm:col-span-2 lg:col-span-3"
            >
                <div className="flex items-center gap-8">
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
