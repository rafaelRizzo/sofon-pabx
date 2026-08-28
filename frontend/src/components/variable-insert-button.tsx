"use client"

import { useState } from "react"
import { BracesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ASTERISK_VARIABLES, insertToken } from "@/lib/asterisk-variables"
import { useVariableCatalog } from "@/hooks/use-variable-catalog"

type Props = {
    onSelect: (token: string) => void
    companyId?: string
    className?: string
}

// Botão compacto pra inserir uma variável de canal Asterisk documentada (ver asterisk-variables.ts)
// ou do catálogo customizado da empresa (companyId, ver use-variable-catalog.ts) na posição do
// cursor de um campo que aceita placeholder {{VAR}} - usar junto de useVariableInsert.
export function VariableInsertButton({ onSelect, companyId, className }: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const { variables: catalogVariables } = useVariableCatalog(companyId)

    const q = query.toLowerCase()
    const filteredCatalog = catalogVariables.filter((v) =>
        `${v.name} ${v.description ?? ""}`.toLowerCase().includes(q)
    )
    const filtered = ASTERISK_VARIABLES.filter((v) =>
        `${v.name} ${v.description}`.toLowerCase().includes(q)
    )
    const isEmpty = filteredCatalog.length === 0 && filtered.length === 0

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) setQuery("")
            }}
        >
            <TooltipProvider delay={100}>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <PopoverTrigger
                                render={
                                    <Button type="button" variant="outline" size="icon" className={className}>
                                        <BracesIcon />
                                        <span className="sr-only">Inserir variável</span>
                                    </Button>
                                }
                            />
                        }
                    />
                    <TooltipContent>Inserir variável</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent align="end" className="w-80 p-1">
                <Input
                    autoFocus
                    placeholder="Buscar variável..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mb-1"
                />
                <ScrollArea className="h-64">
                    {isEmpty ? (
                        <p className="p-2 text-xs text-muted-foreground">Nenhuma variável encontrada</p>
                    ) : (
                        <>
                            {filteredCatalog.length > 0 && (
                                <div>
                                    <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                        Catálogo da empresa
                                    </p>
                                    {filteredCatalog.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => {
                                                onSelect(insertToken(v.name))
                                                setOpen(false)
                                                setQuery("")
                                            }}
                                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                                        >
                                            <code className="text-xs font-medium">{`{{${v.name}}}`}</code>
                                            <span className="text-xs text-muted-foreground">
                                                {v.description || "Variável customizada da empresa"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {filteredCatalog.length > 0 && filtered.length > 0 && (
                                <Separator className="my-1.5" />
                            )}
                            {filtered.length > 0 && (
                                <div>
                                    <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                        Nativas do Asterisk
                                    </p>
                                    {filtered.map((v) => (
                                        <button
                                            key={v.name}
                                            type="button"
                                            onClick={() => {
                                                onSelect(insertToken(v.name))
                                                setOpen(false)
                                                setQuery("")
                                            }}
                                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                                        >
                                            <code className="text-xs font-medium">{`{{${v.name}}}`}</code>
                                            <span className="text-xs text-muted-foreground">{v.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
