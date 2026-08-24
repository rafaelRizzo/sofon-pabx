"use client"

import { useState } from "react"

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
import {
    ACTION_LABEL,
    AUDIT_LOG_MODEL_LABEL,
    type AuditLog,
    type AuditLogAction,
    type AuditLogModel,
} from "@/hooks/use-audit-logs"
import type { Company } from "@/hooks/use-companies"
import { AuditLogDetailDialog } from "./audit-log-detail-dialog"

const ACTION_TONE: Record<AuditLogAction, string> = {
    CREATE:
        "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    UPDATE:
        "border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300",
    DELETE:
        "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
}

type Props = {
    records: AuditLog[]
    companies: Company[]
    loading: boolean
    showCompanyColumn?: boolean
}

export function AuditLogTable({ records, companies, loading, showCompanyColumn = true }: Props) {
    const [selected, setSelected] = useState<AuditLog | null>(null)

    const companyName = (companyId: string | null) =>
        companyId ? (companies.find((c) => c.id === companyId)?.name ?? companyId) : "-"

    const columns = 5 + (showCompanyColumn ? 1 : 0)

    return (
        <div className="rounded-md border">
            <Table className="w-max min-w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">Data/Hora</TableHead>
                        <TableHead className="text-center">Usuário</TableHead>
                        <TableHead className="text-center">Ação</TableHead>
                        <TableHead className="text-center">Recurso</TableHead>
                        {showCompanyColumn && (
                            <TableHead className="text-center">Empresa</TableHead>
                        )}
                        <TableHead className="text-center">Detalhes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: columns }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="mx-auto h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : records.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={columns} className="h-24 text-center text-muted-foreground">
                                Nenhum registro encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell className="text-center text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-center font-medium">
                                    {log.actorName ?? "Usuário removido"}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={ACTION_TONE[log.action]}>
                                        {ACTION_LABEL[log.action] ?? log.action}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    {AUDIT_LOG_MODEL_LABEL[log.model as AuditLogModel] ?? log.model}
                                </TableCell>
                                {showCompanyColumn && (
                                    <TableCell className="text-center text-muted-foreground">
                                        {companyName(log.companyId)}
                                    </TableCell>
                                )}
                                <TableCell className="text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelected(log)}
                                    >
                                        Ver
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            <AuditLogDetailDialog
                log={selected}
                onOpenChange={(open) => !open && setSelected(null)}
            />
        </div>
    )
}
