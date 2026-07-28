"use client"

import { useState } from "react"
import { DownloadIcon, PlayIcon } from "lucide-react"

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
import type { Trunk } from "@/hooks/use-trunks"
import { CdrRecordingDialog } from "./cdr-recording-dialog"

const DIRECTION_LABEL: Record<string, string> = {
    inbound: "Entrada",
    outbound: "Saída",
    internal: "Interna",
}

const STATUS_LABEL: Record<string, string> = {
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

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "-"
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatDateTime(value: string | null): string {
    if (!value) return "-"
    return new Date(value).toLocaleString("pt-BR")
}

type Props = {
    records: CdrRecord[]
    trunks: Trunk[]
    loading: boolean
    companyId: string
}

export function CdrTable({ records, trunks, loading, companyId }: Props) {
    const trunkName = (trunkId: string | null) =>
        trunkId ? (trunks.find((t) => t.id === trunkId)?.name ?? trunkId) : "-"

    const [playRecord, setPlayRecord] = useState<CdrRecord | null>(null)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Fila</TableHead>
                        <TableHead>Espera</TableHead>
                        <TableHead>Atendido por</TableHead>
                        <TableHead>Tronco</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gravação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 11 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : records.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={11}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhum registro encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="text-muted-foreground">
                                    {formatDateTime(record.startTime)}
                                </TableCell>
                                <TableCell>
                                    {record.direction ? (
                                        <Badge variant="outline">
                                            {DIRECTION_LABEL[record.direction] ??
                                                record.direction}
                                        </Badge>
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {record.originLabel ||
                                        record.originExtension ||
                                        record.src ||
                                        "-"}
                                </TableCell>
                                <TableCell>
                                    {record.destinationLabel ||
                                        record.dialedNumber ||
                                        record.dst ||
                                        "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {record.queueLabel ?? "-"}
                                </TableCell>
                                <TableCell className="font-mono tabular-nums text-muted-foreground">
                                    {formatDuration(record.queueWaitSeconds)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {record.answeredBy?.label ?? "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {trunkName(record.trunkId)}
                                </TableCell>
                                <TableCell className="font-mono tabular-nums">
                                    {formatDuration(record.billsec)}
                                </TableCell>
                                <TableCell>
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
                                <TableCell>
                                    {record.recordingFile ? (
                                        <div className="flex items-center gap-1">
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
