"use client"

import { PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatDateTime, formatDuration } from "@/components/Cdr/cdr-table"
import { useMyRecentCalls, type CdrRecord } from "@/hooks/use-cdr"

const DIRECTION_ICON = {
    inbound: PhoneIncomingIcon,
    outbound: PhoneOutgoingIcon,
    internal: PhoneOutgoingIcon,
    transfer: PhoneOutgoingIcon,
} as const

function directionOf(record: CdrRecord) {
    return record.direction && record.direction in DIRECTION_ICON
        ? (record.direction as keyof typeof DIRECTION_ICON)
        : "outbound"
}

function counterpartOf(record: CdrRecord) {
    if (record.answeredBy) return record.queueLabel ?? "Fila"
    if (record.direction === "inbound") return record.originLabel || record.src || "Desconhecido"
    return record.destinationLabel || record.dialedNumber || record.dst || "Desconhecido"
}

// Últimas 100 chamadas do ramal do usuário logado (GET /cdr/me) - direto (ramal-a-ramal,
// outbound) + filas atendidas como agente. Sem paginação de propósito, é uma janela fixa.
export function WebphoneCallHistory() {
    const { records, loading } = useMyRecentCalls()

    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        )
    }

    if (records.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Nenhuma chamada registrada ainda
            </p>
        )
    }

    return (
        <ScrollArea className="h-72">
            <div className="flex flex-col divide-y">
                {records.map((record) => {
                    const direction = directionOf(record)
                    const Icon =
                        record.callStatus !== "ANSWERED"
                            ? PhoneMissedIcon
                            : DIRECTION_ICON[direction]
                    const missed = record.callStatus !== "ANSWERED"

                    return (
                        <div
                            key={record.id}
                            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                        >
                            <div
                                className={cn(
                                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                                    missed
                                        ? "bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                <Icon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {counterpartOf(record)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDateTime(record.startTime)}
                                </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 font-mono text-xs">
                                {missed ? "-" : formatDuration(record.billsec)}
                            </Badge>
                        </div>
                    )
                })}
            </div>
        </ScrollArea>
    )
}
