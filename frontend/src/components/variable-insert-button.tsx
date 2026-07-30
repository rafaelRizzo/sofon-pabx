"use client"

import { useState } from "react"
import { BracesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ASTERISK_VARIABLES, insertToken } from "@/lib/asterisk-variables"

type Props = {
    onSelect: (token: string) => void
    className?: string
}

// Botão compacto pra inserir uma variável de canal Asterisk documentada (ver asterisk-variables.ts)
// na posição do cursor de um campo que aceita placeholder {{VAR}} — usar junto de useVariableInsert.
export function VariableInsertButton({ onSelect, className }: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")

    const filtered = ASTERISK_VARIABLES.filter((v) =>
        `${v.name} ${v.description}`.toLowerCase().includes(query.toLowerCase())
    )

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
                                    <Button type="button" variant="outline" size="icon-sm" className={className}>
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
                <div className="max-h-64 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">Nenhuma variável encontrada</p>
                    ) : (
                        filtered.map((v) => (
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
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
