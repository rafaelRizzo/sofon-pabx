"use client"

import { useState } from "react"
import { BracesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxCollection,
    ComboboxGroup,
    ComboboxInput,
    ComboboxItem,
    ComboboxLabel,
    ComboboxList,
} from "@/components/ui/combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useVariableCatalog } from "@/hooks/use-variable-catalog"

export type NativeVariableRef = {
    name: string
    description: string
}

type VariableItem = {
    id: string
    name: string
    description: string
}

type VariableGroup = {
    label: string
    items: VariableItem[]
}

type Props = {
    companyId?: string
    // Lista nativa injetada por quem consome - VariableInsertButton e VariableRefPickerButton usam
    // catálogos diferentes (ver comentário em cada um), esse componente só sabe renderizar/filtrar.
    nativeVariables: NativeVariableRef[]
    onSelect: (name: string) => void
    // Transforma o nome escolhido antes de repassar pro onSelect - VariableInsertButton embrulha em
    // {{VAR}} (token inserido num texto livre), VariableRefPickerButton usa o nome cru (substitui o
    // valor inteiro do campo).
    toToken?: (name: string) => string
    tooltip: string
    disabled?: boolean
    disabledTooltip?: string
    align?: "start" | "end"
    className?: string
}

// Combobox real (Base UI) compartilhado de busca/seleção de variável - catálogo da empresa +
// lista nativa. Único lugar que decide highlight automático, navegação por teclado e agrupamento
// visual do picker; VariableInsertButton e VariableRefPickerButton só parametrizam a lista nativa e
// o que acontece com o nome escolhido.
export function VariablePickerCombobox({
    companyId,
    nativeVariables,
    onSelect,
    toToken = (name) => name,
    tooltip,
    disabled = false,
    disabledTooltip,
    align = "end",
    className,
}: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const { variables: catalogVariables } = useVariableCatalog(companyId)

    const groups: VariableGroup[] = [
        {
            label: "Catálogo da empresa",
            items: catalogVariables.map(
                (v): VariableItem => ({
                    id: `catalog:${v.id}`,
                    name: v.name,
                    description:
                        v.description || "Variável customizada da empresa",
                })
            ),
        },
        {
            label: "Nativas do Asterisk",
            items: nativeVariables.map(
                (v): VariableItem => ({
                    id: `native:${v.name}`,
                    name: v.name,
                    description: v.description,
                })
            ),
        },
    ].filter((g) => g.items.length > 0)

    const matchesQuery = (item: VariableItem, q: string) =>
        `${item.name} ${item.description}`.toLowerCase().includes(q.toLowerCase())

    // `groups` vai pro Combobox sem filtrar (é ele quem aplica `filter` internamente pra computar o
    // highlight/navegação) - `isEmpty` precisa do resultado JÁ filtrado pela query atual, senão nunca
    // detecta "nada encontrado" (groups.length só zera se o catálogo/lista nativa inteiros estiverem
    // vazios, não quando a busca não bate com nada).
    const trimmedQuery = query.trim()
    const isEmpty = !groups.some((g) =>
        g.items.some((item) => matchesQuery(item, trimmedQuery))
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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        disabled={disabled}
                                        className={className}
                                    >
                                        <BracesIcon />
                                        <span className="sr-only">
                                            {tooltip}
                                        </span>
                                    </Button>
                                }
                            />
                        }
                    />
                    <TooltipContent>
                        {disabled && disabledTooltip
                            ? disabledTooltip
                            : tooltip}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent align={align} className="w-80 gap-1 p-1">
                <Combobox<VariableItem>
                    items={groups}
                    value={null}
                    // `open` amarrado ao Popover externo: Enter só seleciona o item destacado quando
                    // open===true (ver ComboboxInput do Base UI), e por padrão o Combobox só fica
                    // open no clique real do input (openOnInputClick) - autoFocus programático não
                    // conta, deixando Enter/filtro sem efeito até o usuário digitar algo.
                    open={open}
                    onOpenChange={setOpen}
                    inputValue={query}
                    onInputValueChange={setQuery}
                    itemToStringLabel={(item) => item.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    filter={matchesQuery}
                    onValueChange={(item) => {
                        if (!item) return
                        onSelect(toToken(item.name))
                        setOpen(false)
                        setQuery("")
                    }}
                >
                    <ComboboxInput
                        autoFocus
                        showTrigger={false}
                        placeholder="Buscar variável..."
                        className="w-full"
                    />
                    {/* Sem ComboboxContent (Portal+Positioner+Popup) de propósito: aninhado dentro do
                    PopoverContent, o popup próprio do Combobox faz auto-flip pra cima quando não cabe
                    embaixo (perto da borda do dialog), invertendo busca/lista visualmente. Lista
                    estática, sempre abaixo do input, evita esse flip. */}
                    {isEmpty ? (
                        <p className="p-2 text-xs text-muted-foreground">
                            Nenhuma variável encontrada
                        </p>
                    ) : (
                        <ComboboxList className="max-h-64 overflow-y-auto">
                            {(group: VariableGroup, index: number) => (
                                <ComboboxGroup
                                    key={group.label}
                                    items={group.items}
                                    className={
                                        index > 0
                                            ? "mt-1 border-t border-border/50 pt-1"
                                            : undefined
                                    }
                                >
                                    <ComboboxLabel className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                        {group.label}
                                    </ComboboxLabel>
                                    <ComboboxCollection>
                                        {(item: VariableItem) => (
                                            <ComboboxItem
                                                key={item.id}
                                                value={item}
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <code className="text-xs font-medium">
                                                        {toToken(item.name)}
                                                    </code>
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.description}
                                                    </span>
                                                </div>
                                            </ComboboxItem>
                                        )}
                                    </ComboboxCollection>
                                </ComboboxGroup>
                            )}
                        </ComboboxList>
                    )}
                </Combobox>
            </PopoverContent>
        </Popover>
    )
}
