"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { CallQualityRecord } from "@/hooks/use-call-quality"

// Perda de pacote > 0 já é digno de nota num link de voz (destoa do resto, sem cor = "normal") -
// mesmo critério usado no card ao vivo de tronco (realtime-trunk-cards.tsx)
function lossClass(pct: number | null): string {
    if (pct == null) return "text-muted-foreground"
    return pct > 0 ? "text-amber-600 dark:text-amber-400" : ""
}

function fmt(value: number | null, digits: number, suffix = ""): string {
    if (value == null) return "-"
    return `${value.toFixed(digits)}${suffix}`
}

type Props = {
    records: CallQualityRecord[]
    loading: boolean
}

export function CallQualityTable({ records, loading }: Props) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tronco</TableHead>
                    <TableHead className="text-center">
                        Jitter RX / Perda
                    </TableHead>
                    <TableHead className="text-center">
                        Jitter TX / Perda
                    </TableHead>
                    <TableHead className="text-center">RTT</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                                <TableCell key={j}>
                                    <Skeleton className="h-4 w-full" />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                ) : records.length === 0 ? (
                    <TableRow>
                        <TableCell
                            colSpan={6}
                            className="h-24 text-center text-muted-foreground"
                        >
                            Nenhum registro de qualidade de rede no período
                        </TableCell>
                    </TableRow>
                ) : (
                    records.map((r) => (
                        <TableRow key={r.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                                {format(new Date(r.startAt), "dd/MM/yy HH:mm:ss", {
                                    locale: ptBR,
                                })}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                                {r.callerNum || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                                {r.trunkName ?? "-"}
                            </TableCell>
                            <TableCell className="text-center font-mono text-sm">
                                <span>{fmt(r.avgRxJitterUnits, 1)}</span>
                                {" / "}
                                <span className={cn(lossClass(r.avgRxLostPct))}>
                                    {fmt(r.avgRxLostPct, 2, "%")}
                                </span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-sm">
                                <span>{fmt(r.avgTxJitterUnits, 1)}</span>
                                {" / "}
                                <span className={cn(lossClass(r.avgTxLostPct))}>
                                    {fmt(r.avgTxLostPct, 2, "%")}
                                </span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-sm">
                                {fmt(r.avgRttSeconds, 4, "s")}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}
