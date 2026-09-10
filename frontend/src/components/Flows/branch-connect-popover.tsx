"use client"

import { useEffect, useState } from "react"

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    ROUTE_DEST_ICONS,
    ROUTE_DEST_LABELS,
    fetchDestinationOptions,
    type DestinationOption,
} from "@/components/RouteDestination/route-destination-field"
import {
    CANVAS_NODE_TYPES,
    NODE_TYPE_CONFIG,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import { Button } from "@/components/ui/button"
import { type BranchConnectPopoverProps } from "@/components/Flows/types"

const TYPE_ITEMS = CANVAS_NODE_TYPES.map((t) => ({
    value: t,
    label: ROUTE_DEST_LABELS[t],
}))

// Picker compacto pra conectar um slot (true/false/success/error/default) direto a um destino já
// configurado, sem precisar arrastar uma linha no canvas - mesmos helpers do painel lateral
// (add-node-panel.tsx), sem filtro de "já usado": reusar o mesmo destino em vários pontos do flow
// é permitido (ver plano).
export function BranchConnectPopover({
    companyId,
    defaultType = "queue",
    currentOption = null,
    trigger,
    onSelect,
    onCreate,
}: BranchConnectPopoverProps) {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState<CanvasNodeType>(defaultType)
    const [selected, setSelected] = useState<DestinationOption | null>(
        currentOption
    )
    const [query, setQuery] = useState(currentOption?.label ?? "")
    const [options, setOptions] = useState<DestinationOption[]>([])
    const [loading, setLoading] = useState(false)

    // Reidrata tipo + valor selecionado toda vez que o popover abre - sem isso ele sempre
    // reabria em "queue"/vazio, ignorando o destino já conectado no slot (defaultType e
    // currentOption só importam no instante da abertura, por isso o dep array é só [open]).
    // query também é resetado aqui - sem isso o texto digitado numa abertura anterior (que
    // não bateu com nenhum item e por isso não chamou onSelect) ficava "grudado" no input,
    // dando a falsa impressão de que dava pra renomear o destino digitando ali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!open) return
        setType(defaultType)
        setSelected(currentOption)
        setQuery(currentOption?.label ?? "")
    }, [open])

    useEffect(() => {
        if (!open) return
        setLoading(true)
        fetchDestinationOptions(type, companyId)
            .then(setOptions)
            .finally(() => setLoading(false))
    }, [open, type, companyId])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={trigger} />
            <PopoverContent className="w-64 gap-2 p-2" align="start">
                <Select
                    items={TYPE_ITEMS}
                    value={type}
                    onValueChange={(v) => {
                        const newType = v as CanvasNodeType
                        if (newType !== type) {
                            setSelected(null)
                            setQuery("")
                        }
                        setType(newType)
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo de destino" />
                    </SelectTrigger>
                    <SelectContent>
                        {CANVAS_NODE_TYPES.map((t) => {
                            const Icon = ROUTE_DEST_ICONS[t]
                            return (
                                <SelectItem key={t} value={t}>
                                    <Icon /> {ROUTE_DEST_LABELS[t]}
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>

                <Combobox<DestinationOption>
                    key={type}
                    items={options}
                    value={selected}
                    inputValue={query}
                    onInputValueChange={setQuery}
                    itemToStringLabel={(o) => o.label}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(opt) => {
                        if (!opt) return
                        setSelected(opt)
                        setQuery(opt.label)
                        onSelect(type, opt)
                        setOpen(false)
                    }}
                >
                    <ComboboxInput
                        placeholder={
                            loading
                                ? "Carregando..."
                                : `Buscar ${ROUTE_DEST_LABELS[type].toLowerCase()}...`
                        }
                        disabled={loading}
                        className="w-full"
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>
                            {loading
                                ? "Carregando..."
                                : "Nenhum destino encontrado"}
                        </ComboboxEmpty>
                        <ComboboxList>
                            {(opt: DestinationOption) => (
                                <ComboboxItem
                                    key={opt.id}
                                    value={opt}
                                    disabled={!!opt.disabledReason}
                                >
                                    {opt.label}
                                    {opt.disabledReason && (
                                        <span className="text-xs text-muted-foreground">
                                            ({opt.disabledReason})
                                        </span>
                                    )}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
                {onCreate && NODE_TYPE_CONFIG[type].creatable && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                            onCreate(type)
                            setOpen(false)
                        }}
                    >
                        Criar {ROUTE_DEST_LABELS[type].toLowerCase()}
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    )
}
