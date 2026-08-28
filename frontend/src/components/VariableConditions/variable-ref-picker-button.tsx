"use client"

import { useState } from "react"
import { BracesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useVariableCatalog } from "@/hooks/use-variable-catalog"

// Variáveis nativas do Asterisk aceitas por SAFE_VARIABLE_REF_REGEX
// (backend/src/schemas/dialplan-safety.ts) além de identificadores simples - não reaproveita
// ASTERISK_VARIABLES de lib/asterisk-variables.ts porque aquela lista é pro mecanismo de
// placeholder {{VAR}} resolvido via AGI (Request Templates/IXCsoft), com um subconjunto diferente
// (ani/rdnis/dnid não são lidos ali, mas são válidos aqui por interpolação direta no dialplan)
type BuiltinVariableRef = {
    name: string
    description: string
    // true = inserir como template editável (tem parte livre que o usuário precisa preencher)
    template?: boolean
}

const BUILTIN_VARIABLE_REFS: BuiltinVariableRef[] = [
    { name: "CALLERID(num)", description: "Número de quem está ligando" },
    {
        name: "CALLERID(name)",
        description: "Nome de quem está ligando, quando disponível (CNAM)",
    },
    {
        name: "CALLERID(ani)",
        description: "ANI - número de origem informado pelo tronco",
    },
    {
        name: "CALLERID(rdnis)",
        description: "Número redirecionador (RDNIS), em chamadas transferidas",
    },
    {
        name: "CALLERID(dnid)",
        description: "Número originalmente discado (DNID)",
    },
    { name: "EXTEN", description: "Número/ramal discado nesta etapa do fluxo" },
    { name: "UNIQUEID", description: "Identificador único desta chamada" },
    {
        name: "DB(family/key)",
        description: "Valor salvo no Asterisk DB - edite family/key antes de usar",
        template: true,
    },
]

type Props = {
    companyId: string
    onSelect: (variable: string) => void
    className?: string
}

// Botão que abre um picker de referências de variável válidas pra VariableCondition.rules[].variable
// (mesmas 3 formas aceitas por SAFE_VARIABLE_REF_REGEX: nome do catálogo, CALLERID(...), DB(...)) -
// ao contrário de VariableInsertButton, aqui o clique substitui o valor inteiro do campo (a
// variável é o valor do campo, não um token embutido num texto livre).
export function VariableRefPickerButton({ companyId, onSelect, className }: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const { variables: catalogVariables } = useVariableCatalog(companyId)

    const q = query.toLowerCase()
    const filteredCatalog = catalogVariables.filter((v) =>
        `${v.name} ${v.description ?? ""}`.toLowerCase().includes(q)
    )
    const filteredBuiltins = BUILTIN_VARIABLE_REFS.filter((v) =>
        `${v.name} ${v.description}`.toLowerCase().includes(q)
    )
    const isEmpty = filteredCatalog.length === 0 && filteredBuiltins.length === 0

    function pick(name: string) {
        onSelect(name)
        setOpen(false)
        setQuery("")
    }

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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        disabled={!companyId}
                                        className={className}
                                    >
                                        <BracesIcon />
                                        <span className="sr-only">
                                            Escolher variável
                                        </span>
                                    </Button>
                                }
                            />
                        }
                    />
                    <TooltipContent>
                        {companyId
                            ? "Escolher variável"
                            : "Selecione a empresa primeiro"}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent align="start" className="w-80 p-1">
                <Input
                    autoFocus
                    placeholder="Buscar variável..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mb-1"
                />
                <ScrollArea className="h-72">
                    {isEmpty ? (
                        <p className="p-2 text-xs text-muted-foreground">
                            Nenhuma variável encontrada
                        </p>
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
                                            onClick={() => pick(v.name)}
                                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                                        >
                                            <code className="text-xs font-medium">
                                                {v.name}
                                            </code>
                                            <span className="text-xs text-muted-foreground">
                                                {v.description || "Variável customizada da empresa"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {filteredCatalog.length > 0 && filteredBuiltins.length > 0 && (
                                <Separator className="my-1.5" />
                            )}
                            {filteredBuiltins.length > 0 && (
                                <div>
                                    <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                        Nativas do Asterisk
                                    </p>
                                    {filteredBuiltins.map((v) => (
                                        <button
                                            key={v.name}
                                            type="button"
                                            onClick={() => pick(v.name)}
                                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                                        >
                                            <code className="text-xs font-medium">
                                                {v.name}
                                            </code>
                                            <span className="text-xs text-muted-foreground">
                                                {v.description}
                                            </span>
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
