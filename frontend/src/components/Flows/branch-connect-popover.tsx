"use client"

import { useEffect, useState, type ReactElement } from "react"

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

const TYPE_ITEMS = CANVAS_NODE_TYPES.map((t) => ({
    value: t,
    label: ROUTE_DEST_LABELS[t],
}))

type Props = {
    companyId: string
    defaultType?: CanvasNodeType
    trigger: ReactElement
    onSelect: (type: CanvasNodeType, option: DestinationOption) => void
    onCreate?: (type: CanvasNodeType) => void
}

// Picker compacto pra conectar um slot (true/false/success/error/default) direto a um destino já
// configurado, sem precisar arrastar uma linha no canvas — mesmos helpers do painel lateral
// (add-node-panel.tsx), sem filtro de "já usado": reusar o mesmo destino em vários pontos do flow
// é permitido (ver plano).
export function BranchConnectPopover({
    companyId,
    defaultType = "queue",
    trigger,
    onSelect,
    onCreate,
}: Props) {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState<CanvasNodeType>(defaultType)
    const [options, setOptions] = useState<DestinationOption[]>([])
    const [loading, setLoading] = useState(false)

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
                    onValueChange={(v) => setType(v as CanvasNodeType)}
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
                    value={null}
                    itemToStringLabel={(o) => o.label}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(opt) => {
                        if (!opt) return
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
