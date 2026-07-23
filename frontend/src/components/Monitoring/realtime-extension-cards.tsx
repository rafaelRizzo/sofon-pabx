"use client"

import { UsersIcon } from "lucide-react"
import { useMemo } from "react"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { CallStateBadge, PresenceBadge } from "@/components/presence-badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { activeCallLabel } from "@/lib/realtime-format"
import type { RealtimeExtension, RealtimeQueue } from "@/hooks/use-realtime"

type Props = {
    extensions: RealtimeExtension[]
    queues: RealtimeQueue[]
    loading: boolean
    companySelected: boolean
    // sobrescreve a mensagem de "nenhum ramal" — usado quando o hideOffline filtrou tudo (front,
    // ver monitoring/page.tsx), pra não parecer que a empresa não tem ramal nenhum cadastrado
    emptyMessage?: string
}

export function RealtimeExtensionCards({
    extensions,
    queues,
    loading,
    companySelected,
    emptyMessage,
}: Props) {
    const queuesByExtensionId = useMemo(() => {
        const result = new Map<string, RealtimeQueue[]>()

        for (const queue of queues) {
            for (const member of queue.members) {
                const extensionQueues = result.get(member.extensionId) ?? []
                extensionQueues.push(queue)
                result.set(member.extensionId, extensionQueues)
            }
        }

        return result
    }, [queues])

    if (loading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} size="sm">
                        <CardHeader>
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (extensions.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {emptyMessage ??
                    (companySelected
                        ? "Nenhum ramal encontrado"
                        : "Selecione uma empresa para listar")}
            </p>
        )
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {extensions.map((ext) => {
                const activeCall = ext.activeCalls[0]
                const extensionQueues = queuesByExtensionId.get(ext.id) ?? []
                return (
                    <Card key={ext.id} size="sm">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="font-mono">{ext.alias}</span>
                                <PresenceBadge presence={ext.presence} />
                            </CardTitle>
                            <CardDescription className="truncate">
                                {ext.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between gap-2">
                            <CallStateBadge callState={ext.callState} />
                            <div className="flex min-w-0 items-center gap-2">
                                {extensionQueues.length > 0 && (
                                    <TooltipProvider delay={100}>
                                        <Tooltip>
                                            <TooltipTrigger
                                                render={
                                                    <span
                                                        aria-label={`Filas: ${extensionQueues
                                                            .map(
                                                                (queue) =>
                                                                    queue.number
                                                            )
                                                            .join(", ")}`}
                                                        className="flex shrink-0 text-muted-foreground"
                                                    >
                                                        <UsersIcon className="size-4" />
                                                    </span>
                                                }
                                            />
                                            <TooltipContent>
                                                Filas:{" "}
                                                {extensionQueues
                                                    .map(
                                                        (queue) => queue.number
                                                    )
                                                    .join(", ")}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {activeCall && (
                                    <TooltipProvider delay={100}>
                                        <Tooltip>
                                            <TooltipTrigger
                                                render={
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {activeCallLabel(
                                                            activeCall
                                                        )}
                                                    </span>
                                                }
                                            />
                                            <TooltipContent>
                                                {activeCallLabel(activeCall)}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
