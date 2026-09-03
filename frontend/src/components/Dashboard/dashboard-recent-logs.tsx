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
import { cn } from "@/lib/utils"
import {
    ACTION_LABEL,
    AUDIT_LOG_MODEL_LABEL,
    useAuditLogs,
    type AuditLogAction,
    type AuditLogModel,
} from "@/hooks/use-audit-logs"

const ACTION_TONE: Record<AuditLogAction, string> = {
    CREATE:
        "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    UPDATE:
        "border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300",
    DELETE:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
}

const LIMIT = 5

type Props = {
    companyId: string | undefined
}

export function DashboardRecentLogs({ companyId }: Props) {
    const { records, loading } = useAuditLogs(companyId, {}, LIMIT)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Últimos logs</CardTitle>
                <CardAction>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to="/dashboard/audit-logs" />}
                    >
                        Ver tudo
                        <ArrowRightIcon />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))
                ) : records.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum log registrado
                    </p>
                ) : (
                    records.map((log) => (
                        <div
                            key={log.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                    {log.actorName ?? "Usuário removido"}
                                    <span className="text-muted-foreground">
                                        {" "}
                                        alterou{" "}
                                    </span>
                                    {AUDIT_LOG_MODEL_LABEL[
                                        log.model as AuditLogModel
                                    ] ?? log.model}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleString(
                                        "pt-BR"
                                    )}
                                </span>
                            </div>
                            <Badge
                                variant="outline"
                                className={cn("shrink-0", ACTION_TONE[log.action])}
                            >
                                {ACTION_LABEL[log.action] ?? log.action}
                            </Badge>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
