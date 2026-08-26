"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    type AuditLogModel,
} from "@/hooks/use-audit-logs"

function formatValue(value: unknown): string {
    if (value === undefined) return "-"
    if (value === null) return "null"
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
}

// Diff campo a campo só faz sentido quando before/after são o snapshot de 1 registro (o caso
// comum); updateMany/deleteMany internos guardam array/contador em vez disso, tratado à parte
function isSingleRecordSnapshot(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

// updatedAt sempre muda junto de qualquer edição real (Prisma @updatedAt) — não é uma mudança de
// negócio, então some da tabela mesmo quando outros campos realmente mudaram (ver IGNORED_DIFF_FIELDS
// espelhado em backend/src/lib/prisma.ts, que usa o mesmo campo pra decidir se grava o log ou não)
const IGNORED_DIFF_FIELDS = new Set(["updatedAt"])

function diffFields(before: unknown, after: unknown) {
    const beforeObj = isSingleRecordSnapshot(before) ? before : {}
    const afterObj = isSingleRecordSnapshot(after) ? after : {}
    const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])

    return [...keys]
        .filter((key) => !IGNORED_DIFF_FIELDS.has(key))
        .filter((key) => JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]))
        .sort((a, b) => a.localeCompare(b))
        .map((field) => ({ field, before: beforeObj[field], after: afterObj[field] }))
}

type Props = {
    log: AuditLog | null
    onOpenChange: (open: boolean) => void
}

export function AuditLogDetailDialog({ log, onOpenChange }: Props) {
    const isBulk = Array.isArray(log?.before) || (log?.after && "affectedIds" in (log.after as object))
    const rows = log && !isBulk ? diffFields(log.before, log.after) : []

    return (
        <Dialog open={!!log} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {log && (AUDIT_LOG_MODEL_LABEL[log.model as AuditLogModel] ?? log.model)}
                        {" · "}
                        {log && (ACTION_LABEL[log.action] ?? log.action)}
                    </DialogTitle>
                    {log && (
                        <DialogDescription>
                            {log.actorName ?? "Usuário removido"}
                            {" · "}
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                            {log.recordId && ` · ${log.recordId}`}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {isBulk ? (
                    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                        {JSON.stringify({ before: log?.before, after: log?.after }, null, 2)}
                    </pre>
                ) : rows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum campo alterado registrado
                    </p>
                ) : (
                    <div className="max-h-96 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campo</TableHead>
                                    <TableHead>Antes</TableHead>
                                    <TableHead>Depois</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.field}>
                                        <TableCell className="font-medium">{row.field}</TableCell>
                                        <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                                            {formatValue(row.before)}
                                        </TableCell>
                                        <TableCell className="max-w-64 truncate font-mono text-xs">
                                            {formatValue(row.after)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
