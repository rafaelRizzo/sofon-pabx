"use client"

import { useState } from "react"
import { ChevronRightIcon, ChevronDownIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
    data: unknown
    onPick: (path: string, key: string) => void
}

function buildPath(parentPath: string, key: string | number): string {
    if (typeof key === "number") return `${parentPath}[${key}]`
    return parentPath ? `${parentPath}.${key}` : key
}

function formatLeaf(value: unknown): string {
    if (value === null) return "null"
    if (typeof value === "string") return `"${value}"`
    return String(value)
}

function JsonNode({
    label,
    value,
    path,
    onPick,
    depth,
}: {
    label: string
    value: unknown
    path: string
    onPick: (path: string, key: string) => void
    depth: number
}) {
    const [open, setOpen] = useState(depth < 1)
    const isArray = Array.isArray(value)
    const isObject = !isArray && value !== null && typeof value === "object"

    if (isArray || isObject) {
        const entries = isArray
            ? value.map((v, i) => [i, v] as const)
            : Object.entries(value as Record<string, unknown>)

        return (
            <div style={{ paddingLeft: depth > 0 ? 14 : 0 }}>
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="flex items-center gap-1 rounded px-1 py-0.5 font-mono text-xs hover:bg-muted"
                >
                    {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
                    <span className="text-foreground">{label}</span>
                    <span className="text-muted-foreground">
                        {isArray ? `[${entries.length}]` : `{${entries.length}}`}
                    </span>
                </button>
                {open && (
                    <div className="border-l ml-1.5 pl-1">
                        {entries.length === 0 && (
                            <div className="px-2 py-0.5 text-xs text-muted-foreground">vazio</div>
                        )}
                        {entries.map(([key, v]) => (
                            <JsonNode
                                key={key}
                                label={String(key)}
                                value={v}
                                path={buildPath(path, key)}
                                onPick={onPick}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            style={{ paddingLeft: depth > 0 ? 14 : 0 }}
            className="group flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-xs hover:bg-muted"
        >
            <span className="text-foreground">{label}:</span>
            <span className="truncate text-muted-foreground">{formatLeaf(value)}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-5 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => onPick(path, label)}
            >
                <PlusIcon className="size-3" />
                <span className="sr-only">Usar como variável</span>
            </Button>
        </div>
    )
}

export function IxcResponseTree({ data, onPick }: Props) {
    if (data === null || typeof data !== "object") {
        return <div className="p-2 font-mono text-xs text-muted-foreground">{formatLeaf(data)}</div>
    }

    const entries = Array.isArray(data)
        ? data.map((v, i) => [i, v] as const)
        : Object.entries(data as Record<string, unknown>)

    if (entries.length === 0) {
        return <div className="p-2 text-xs text-muted-foreground">Resposta vazia.</div>
    }

    return (
        <div className={cn("max-h-64 space-y-0.5 overflow-auto rounded-md border p-2")}>
            {entries.map(([key, v]) => (
                <JsonNode
                    key={key}
                    label={String(key)}
                    value={v}
                    path={buildPath("", key)}
                    onPick={onPick}
                    depth={0}
                />
            ))}
        </div>
    )
}
