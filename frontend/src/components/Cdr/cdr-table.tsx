"use client"

import { useState } from "react"
import {
    ArrowLeftRightIcon,
    DownloadIcon,
    PhoneIncomingIcon,
    PhoneOutgoingIcon,
    PlayIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { downloadCdrRecording, type CdrRecord } from "@/hooks/use-cdr"
import { type CdrTableProps } from "@/components/Cdr/types"
import { CdrRecordingDialog } from "./cdr-recording-dialog"

export const DIRECTION_LABEL: Record<string, string> = {
    inbound: "Entrada",
    outbound: "Saída",
    internal: "Interna",
    transfer: "Transferência",
}

const DIRECTION_ICON: Record<string, typeof PhoneIncomingIcon> = {
    inbound: PhoneIncomingIcon,
    outbound: PhoneOutgoingIcon,
    internal: ArrowLeftRightIcon,
    transfer: ArrowLeftRightIcon,
}

const DIRECTION_TONE: Record<string, string> = {
    inbound:
        "border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300",
    outbound:
        "border-transparent bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300",
    internal:
        "border-transparent bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-300",
    transfer:
        "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
}

export const STATUS_LABEL: Record<string, string> = {
    ANSWERED: "Atendida",
    "NO ANSWER": "Não atendida",
    BUSY: "Ocupado",
    FAILED: "Falha",
    CONGESTION: "Congestionamento",
}

const STATUS_TONE: Record<string, string> = {
    ANSWERED:
        "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    "NO ANSWER":
        "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
    BUSY:
        "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
    FAILED:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    CONGESTION:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
}

export function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "-"
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatDateTime(value: string | null): string {
    if (!value) return "-"
    return new Date(value).toLocaleString("pt-BR")
}

export function CdrTable({
    records,
    trunks,
    loading,
    companyId,
}: CdrTableProps) {
    const trunkName = (trunkId: string | null) =>
        trunkId ? (trunks.find((t) => t.id === trunkId)?.name ?? trunkId) : "-"

    const [playRecord, setPlayRecord] = useState<CdrRecord | null>(null)

    return (
        <div className="rounded-md border">
            {/* w-max + min-w-full: cresce alem do container quando as 12 colunas (todas
            whitespace-nowrap) nao cabem, acionando o overflow-x-auto do wrapper da Table em vez
            de forcar w-full e espremer as colunas sem scroll */}
            <Table className="w-max min-w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">Data/Hora</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Origem</TableHead>
                        <TableHead className="text-center">Destino</TableHead>
                        <TableHead className="text-center">Fila</TableHead>
                        <TableHead className="text-center">Espera</TableHead>
                        <TableHead className="text-center">Atendido por</TableHead>
                        <TableHead className="text-center">Tronco</TableHead>
                        <TableHead className="text-center">Tronco de entrada (real)</TableHead>
                        <TableHead className="text-center">Duração</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Gravação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 12 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="mx-auto h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : records.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={12}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhum registro encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="text-center text-muted-foreground">
                                    {formatDateTime(record.startTime)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {record.direction ? (
                                        (() => {
                                            const DirectionIcon =
                                                DIRECTION_ICON[record.direction]
                                            return (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        DIRECTION_TONE[
                                                            record.direction
                                                        ]
                                                    }
                                                >
                                                    {DirectionIcon && (
                                                        <DirectionIcon />
                                                    )}
                                                    {DIRECTION_LABEL[
                                                        record.direction
                                                    ] ?? record.direction}
                                                </Badge>
                                            )
                                        })()
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>
                                <TableCell className="text-center font-medium">
                                    {record.originLabel ||
                                        record.originExtension ||
                                        record.src ||
                                        "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                    {record.destinationLabel ||
                                        record.dialedNumber ||
                                        record.dst ||
                                        "-"}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                    {record.queueLabel ?? "-"}
                                </TableCell>
                                <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
                                    {formatDuration(record.queueWaitSeconds)}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                    {record.answeredBy?.label ?? "-"}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                    {trunkName(record.trunkId)}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                    {trunkName(record.entryTrunkId)}
                                </TableCell>
                                <TableCell className="text-center font-mono tabular-nums">
                                    {formatDuration(record.billsec)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {record.callStatus ? (
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                STATUS_TONE[record.callStatus]
                                            )}
                                        >
                                            {STATUS_LABEL[record.callStatus] ??
                                                record.callStatus}
                                        </Badge>
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {record.recordingFile &&
                                    record.callStatus === "ANSWERED" ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() =>
                                                    setPlayRecord(record)
                                                }
                                            >
                                                <PlayIcon />
                                                <span className="sr-only">
                                                    Ouvir gravação
                                                </span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() =>
                                                    downloadCdrRecording(
                                                        record.id,
                                                        companyId
                                                    )
                                                }
                                            >
                                                <DownloadIcon />
                                                <span className="sr-only">
                                                    Baixar gravação
                                                </span>
                                            </Button>
                                        </div>
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            <CdrRecordingDialog
                record={playRecord}
                companyId={companyId}
                onOpenChange={(open) => !open && setPlayRecord(null)}
            />
        </div>
    )
}
