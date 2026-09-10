"use client"

import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { type CompanySelectProps } from "@/components/Users/types"

export function CompanySelect({
    companies,
    value,
    onChange,
    className,
}: CompanySelectProps) {
    const [search, setSearch] = useState("")
    const filtered = companies.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    function toggle(companyId: string, checked: boolean) {
        onChange(
            checked
                ? [...value, companyId]
                : value.filter((id) => id !== companyId)
        )
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                    {filtered.length === 0 ? (
                        <p className="p-2 text-sm text-muted-foreground">
                            Nenhuma empresa encontrada
                        </p>
                    ) : (
                        filtered.map((company) => {
                            const selected = value.includes(company.id)
                            return (
                                <label
                                    key={company.id}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-normal transition-colors",
                                        selected
                                            ? "bg-input"
                                            : "hover:bg-accent/60"
                                    )}
                                >
                                    <Checkbox
                                        checked={selected}
                                        onCheckedChange={(checked) =>
                                            toggle(
                                                company.id,
                                                checked === true
                                            )
                                        }
                                    />
                                    <span
                                        className={cn(
                                            selected && "font-medium"
                                        )}
                                    >
                                        {company.name}
                                    </span>
                                </label>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
