"use client"

import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { type Extension } from "@/hooks/use-extensions"

type Props = {
    extensions: Extension[]
    value: string[]
    onChange: (extensionIds: string[]) => void
    className?: string
}

export function ExtensionRestrictSelect({
    extensions,
    value,
    onChange,
    className,
}: Props) {
    const [search, setSearch] = useState("")
    const filtered = extensions.filter((e) =>
        `${e.alias} ${e.name}`.toLowerCase().includes(search.toLowerCase())
    )

    function toggle(extensionId: string, checked: boolean) {
        onChange(
            checked
                ? [...value, extensionId]
                : value.filter((id) => id !== extensionId)
        )
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Input
                placeholder="Buscar ramal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {filtered.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                        Nenhum ramal encontrado
                    </p>
                ) : (
                    filtered.map((ext) => {
                        const selected = value.includes(ext.id)
                        return (
                            <label
                                key={ext.id}
                                className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-normal transition-colors",
                                    selected ? "bg-input" : "hover:bg-accent/60"
                                )}
                            >
                                <Checkbox
                                    checked={selected}
                                    onCheckedChange={(checked) =>
                                        toggle(ext.id, checked === true)
                                    }
                                />
                                <span className={cn(selected && "font-medium")}>
                                    {ext.alias}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {ext.name}
                                </span>
                            </label>
                        )
                    })
                )}
            </div>
        </div>
    )
}
