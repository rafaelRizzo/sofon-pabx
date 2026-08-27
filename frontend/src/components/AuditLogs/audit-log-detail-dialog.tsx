"use client"

import { ArrowRight, Check, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
    ACTION_LABEL,
    AUDIT_LOG_MODEL_LABEL,
    type AuditLog,
    type AuditLogModel,
} from "@/hooks/use-audit-logs"

// updatedAt sempre muda junto de qualquer edição real (Prisma @updatedAt) — não é uma mudança de
// negócio, então some da lista mesmo quando outros campos realmente mudaram (ver IGNORED_DIFF_FIELDS
// espelhado em backend/src/lib/prisma.ts, que usa o mesmo campo pra decidir se grava o log ou não)
const IGNORED_DIFF_FIELDS = new Set(["updatedAt"])

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

// "allowOutbound" -> "Allow Outbound"
function humanizeKey(key: string): string {
    const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatLeafValue(value: unknown): string {
    if (value === undefined) return "vazio"
    if (value === null) return "vazio"
    if (typeof value === "boolean") return value ? "Sim" : "Não"
    if (typeof value === "number") {
        return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
    }
    if (typeof value === "string" && ISO_DATE_RE.test(value)) {
        return new Date(value).toLocaleString("pt-BR")
    }
    return String(value)
}

type Leaf = { groupPath: string[]; fieldLabel: string; value: unknown }

// Achata objetos/arrays em pares "rótulo: valor" — arrays de objetos viram grupos (identificados por
// nodeId/id/name quando existir), pra nunca precisar mostrar chaves/colchetes de JSON cru na tela
function flattenValue(value: unknown, path: string[] = [], out: Leaf[] = []): Leaf[] {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (isPlainObject(item)) {
                const label = String(item.nodeId ?? item.id ?? item.name ?? `Item ${index + 1}`)
                flattenValue(item, [...path, label], out)
            } else {
                out.push({ groupPath: path, fieldLabel: `#${index + 1}`, value: item })
            }
        })
        return out
    }

    if (isPlainObject(value)) {
        for (const [key, val] of Object.entries(value)) {
            if (isPlainObject(val) || Array.isArray(val)) {
                flattenValue(val, [...path, humanizeKey(key)], out)
            } else {
                out.push({ groupPath: path, fieldLabel: humanizeKey(key), value: val })
            }
        }
        return out
    }

    out.push({ groupPath: path.slice(0, -1), fieldLabel: path.at(-1) ?? "Valor", value })
    return out
}

function omitIgnored(record: unknown): unknown {
    if (!isPlainObject(record)) return record
    return Object.fromEntries(Object.entries(record).filter(([key]) => !IGNORED_DIFF_FIELDS.has(key)))
}

type DiffLeaf = { groupPath: string[]; fieldLabel: string; before: unknown; after: unknown; changed: boolean }

function diffLeaves(before: unknown, after: unknown): DiffLeaf[] {
    const beforeLeaves = flattenValue(omitIgnored(before))
    const afterLeaves = flattenValue(omitIgnored(after))
    const keyOf = (leaf: Leaf) => `${leaf.groupPath.join(" · ")}::${leaf.fieldLabel}`

    const beforeMap = new Map(beforeLeaves.map((leaf) => [keyOf(leaf), leaf]))
    const afterMap = new Map(afterLeaves.map((leaf) => [keyOf(leaf), leaf]))
    const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])]

    return keys.map((key) => {
        const b = beforeMap.get(key)
        const a = afterMap.get(key)
        const ref = (b ?? a) as Leaf
        return {
            groupPath: ref.groupPath,
            fieldLabel: ref.fieldLabel,
            before: b?.value,
            after: a?.value,
            changed: JSON.stringify(b?.value) !== JSON.stringify(a?.value),
        }
    })
}

function groupByPath<T extends { groupPath: string[] }>(leaves: T[]): { label: string | null; leaves: T[] }[] {
    const groups: { label: string | null; leaves: T[] }[] = []
    for (const leaf of leaves) {
        const label = leaf.groupPath.length ? leaf.groupPath.join(" · ") : null
        const last = groups.at(-1)
        if (last && last.label === label) last.leaves.push(leaf)
        else groups.push({ label, leaves: [leaf] })
    }
    return groups
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
                navigator.clipboard.writeText(value)
                setCopied(true)
                toast.success("Valor copiado")
                setTimeout(() => setCopied(false), 1200)
            }}
        >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
    )
}

function DiffLeafRow({ leaf }: { leaf: DiffLeaf }) {
    const before = formatLeafValue(leaf.before)
    const after = formatLeafValue(leaf.after)

    return (
        <div className="group flex items-center justify-between gap-3 py-1 text-xs">
            <span className="shrink-0 text-muted-foreground">{leaf.fieldLabel}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate font-mono">
                <span className="truncate text-red-600/80 line-through dark:text-red-400/70">{before}</span>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-emerald-700 dark:text-emerald-400">{after}</span>
                <span className="opacity-0 group-hover:opacity-100">
                    <CopyButton value={after} />
                </span>
            </span>
        </div>
    )
}

function SnapshotLeafRow({ leaf, tone }: { leaf: Leaf; tone: "before" | "after" }) {
    const formatted = formatLeafValue(leaf.value)

    return (
        <div className="group flex items-center justify-between gap-3 py-1 text-xs">
            <span className="shrink-0 text-muted-foreground">{leaf.fieldLabel}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate">
                <span
                    className={cn(
                        "truncate font-mono",
                        tone === "after" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                    )}
                >
                    {formatted}
                </span>
                <span className="opacity-0 group-hover:opacity-100">
                    <CopyButton value={formatted} />
                </span>
            </span>
        </div>
    )
}

function GroupedList<T extends { groupPath: string[] }>({
    leaves,
    renderLeaf,
}: {
    leaves: T[]
    renderLeaf: (leaf: T) => React.ReactNode
}) {
    const groups = groupByPath(leaves)

    return (
        <div className="space-y-3">
            {groups.map((group, index) => (
                <div key={`${group.label ?? "_root"}-${index}`}>
                    {group.label && (
                        <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {group.label}
                        </p>
                    )}
                    <div className="divide-y divide-border/60 rounded-md border px-2.5">
                        {group.leaves.map((leaf, leafIndex) => (
                            <div key={leafIndex}>{renderLeaf(leaf)}</div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

type Props = {
    log: AuditLog | null
    onOpenChange: (open: boolean) => void
}

export function AuditLogDetailDialog({ log, onOpenChange }: Props) {
    const isBulk = Array.isArray(log?.before) || (log?.after && "affectedIds" in (log.after as object))

    const diff = log && !isBulk ? diffLeaves(log.before, log.after).filter((leaf) => leaf.changed) : []
    const isCreate = log?.action === "CREATE"
    const snapshot = log && !isBulk && (isCreate || log.action === "DELETE")
        ? flattenValue(omitIgnored(isCreate ? log.after : log.before))
        : []

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
                    <ScrollArea className="max-h-96 rounded-md border bg-muted/30">
                        <pre className="p-3 text-xs">
                            {JSON.stringify({ before: log?.before, after: log?.after }, null, 2)}
                        </pre>
                    </ScrollArea>
                ) : log?.action === "UPDATE" ? (
                    diff.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Nenhum campo alterado registrado
                        </p>
                    ) : (
                        <ScrollArea className="max-h-[28rem]">
                            <div className="pr-3">
                                <GroupedList leaves={diff} renderLeaf={(leaf) => <DiffLeafRow leaf={leaf} />} />
                            </div>
                        </ScrollArea>
                    )
                ) : snapshot.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhum dado registrado</p>
                ) : (
                    <ScrollArea className="h-[28rem]">
                        <div className="pr-3">
                            <GroupedList
                                leaves={snapshot}
                                renderLeaf={(leaf) => <SnapshotLeafRow leaf={leaf} tone={isCreate ? "after" : "before"} />}
                            />
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    )
}
