"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { QueueMembersPopover } from "@/components/Monitoring/queue-members-popover"
import { LiveDot } from "@/components/Monitoring/live-indicator"
import type { RealtimeExtension, RealtimeQueue } from "@/hooks/use-realtime"

function formatWait(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
}

type Props = {
    queues: RealtimeQueue[]
    extensions: RealtimeExtension[]
    loading: boolean
    companySelected: boolean
}

export function RealtimeQueuesPanel({
    queues,
    extensions,
    loading,
    companySelected,
}: Props) {
    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-4 w-32" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-20 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (queues.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {companySelected
                    ? "Nenhuma fila encontrada"
                    : "Selecione uma empresa para listar"}
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {queues.map((queue) => {
                const waiting = [...queue.waiting].sort(
                    (a, b) => b.waitingSeconds - a.waitingSeconds
                )
                return (
                    <Card key={queue.id}>
                        <CardHeader>
                            <CardTitle className="flex flex-col gap-0.5">
                                <span className="flex items-center justify-between gap-2">
                                    <span className="truncate">
                                        {queue.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">
                                        #{queue.number}
                                    </span>
                                </span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {queue.calls}{" "}
                                    {queue.calls === 1
                                        ? "chamada"
                                        : "chamadas"}{" "}
                                    ·{" "}
                                    {queue.holdtimeSampleSize === 0
                                        ? "sem dados de espera hoje"
                                        : `espera média hoje ${queue.holdtime}s`}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Membros
                                </p>
                                <QueueMembersPopover
                                    members={queue.members}
                                    extensions={extensions}
                                />
                            </div>

                            <div>
                                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    Aguardando ({waiting.length})
                                    {waiting.length > 0 && <LiveDot />}
                                </p>
                                {waiting.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Ninguém na fila
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-1.5">
                                        {waiting.map((caller) => (
                                            <li
                                                key={caller.uniqueid}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="min-w-0 flex-1 truncate font-mono">
                                                    {caller.callerNum || "-"}
                                                </span>
                                                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                                                    há{" "}
                                                    {formatWait(
                                                        caller.waitingSeconds
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
