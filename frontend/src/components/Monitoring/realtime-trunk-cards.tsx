"use client"

import { NetworkIcon } from "lucide-react"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PresenceBadge } from "@/components/presence-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatElapsed } from "@/lib/realtime-format"
import type { RealtimeTrunkActiveCall } from "@/hooks/use-realtime"
import { type RealtimeTrunkCardsProps } from "@/components/Monitoring/types"

// Cor do ícone por tipo de tronco: reforça a distinção pjsip (padrão) / sip (legado,
// ver project_sip_peers_legacy) / iax (alternativo) sem precisar de badge extra por card.
const TYPE_ACCENT: Record<string, string> = {
    pjsip: "bg-sky-500/15 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300",
    sip: "bg-slate-500/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300",
    iax: "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300",
}

// Perda de pacote > 0 já é digno de nota num link de voz (destoa do resto, sem cor = "normal")
function lossClass(pct: number | null): string {
    if (pct == null) return "text-muted-foreground"
    return pct > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
}

// Unidades de jitter são as nativas do RTP (timestamp units do RTCP), não ms - o backend não tem
// o codec da chamada disponível no evento RTCPSent/RTCPReceived pra fazer essa conversão
function TrunkCallNetworkRow({ call }: { call: RealtimeTrunkActiveCall }) {
    return (
        <div className="rounded-md border bg-muted/40 p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{call.callerNum || "-"}</span>
                <span className="shrink-0 text-muted-foreground">
                    há {formatElapsed(call.startAt)}
                </span>
            </div>
            {call.network ? (
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
                    <span className={lossClass(call.network.rxLostPct)}>
                        RX jitter {call.network.rxJitterUnits ?? "-"} · perda{" "}
                        {call.network.rxLostPct ?? 0}%
                    </span>
                    <span className={lossClass(call.network.txLostPct)}>
                        TX jitter {call.network.txJitterUnits ?? "-"} · perda{" "}
                        {call.network.txLostPct ?? 0}%
                    </span>
                    <span className="col-span-2 text-muted-foreground">
                        RTT {call.network.rttSeconds ?? "-"}s
                    </span>
                </div>
            ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Aguardando primeira amostra RTCP...
                </p>
            )}
        </div>
    )
}

export function RealtimeTrunkCards({
    trunks,
    loading,
    companySelected,
}: RealtimeTrunkCardsProps) {
    if (loading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} size="sm">
                        <CardHeader className="gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        )
    }

    if (trunks.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {companySelected
                    ? "Nenhum tronco encontrado"
                    : "Selecione uma empresa para listar"}
            </p>
        )
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trunks.map((trunk) => (
                <Card key={trunk.id} size="sm">
                    <CardHeader>
                        <CardTitle className="flex min-w-0 items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-md",
                                        TYPE_ACCENT[trunk.type] ??
                                            "bg-muted text-muted-foreground"
                                    )}
                                >
                                    <NetworkIcon className="size-3.5" />
                                </span>
                                <span className="truncate">{trunk.name}</span>
                            </span>
                            <PresenceBadge presence={trunk.presence} />
                        </CardTitle>
                        <CardDescription className="pl-8">
                            <Badge variant="outline">
                                {trunk.type.toUpperCase()}
                            </Badge>
                        </CardDescription>
                    </CardHeader>
                    {trunk.activeCalls.length > 0 && (
                        <CardContent className="flex flex-col gap-2 pt-0">
                            {trunk.activeCalls.map((call) => (
                                <TrunkCallNetworkRow key={call.uniqueid} call={call} />
                            ))}
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    )
}
