"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    DIRECTION_LABEL,
    STATUS_LABEL,
    formatDateTime,
    formatDuration,
} from "@/components/Cdr/cdr-table"
import { useCdrRecords } from "@/hooks/use-cdr"
import { type DashboardRecentCallsProps } from "@/components/Dashboard/types"

const STATUS_TONE: Record<string, string> = {
    ANSWERED:
        "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    "NO ANSWER":
        "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
    BUSY: "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
    FAILED:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    CONGESTION:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
}

const LIMIT = 5

export function DashboardRecentCalls({
    companyId,
}: DashboardRecentCallsProps) {
    const { records, loading } = useCdrRecords(
        companyId,
        { order: "desc" },
        LIMIT
    )

    return (
        <Card>
            <CardHeader>
                <CardTitle>Últimas ligações</CardTitle>
                <CardAction>
                    <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link to="/dashboard/cdr" />}
                    >
                        Ver tudo
                        <ArrowRightIcon />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                {!companyId ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Selecione uma empresa para ver as últimas ligações
                    </p>
                ) : loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))
                ) : records.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Nenhuma ligação registrada
                    </p>
                ) : (
                    records.map((record) => (
                        <div
                            key={record.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                    {record.originLabel ||
                                        record.originExtension ||
                                        record.src ||
                                        "-"}
                                    <span className="text-muted-foreground"> → </span>
                                    {record.destinationLabel ||
                                        record.dialedNumber ||
                                        record.dst ||
                                        "-"}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {formatDateTime(record.startTime)}
                                    {record.direction &&
                                        ` · ${DIRECTION_LABEL[record.direction] ?? record.direction}`}
                                </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {formatDuration(record.billsec)}
                                </span>
                                {record.callStatus && (
                                    <Badge
                                        variant="outline"
                                        className={STATUS_TONE[record.callStatus]}
                                    >
                                        {STATUS_LABEL[record.callStatus] ??
                                            record.callStatus}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
