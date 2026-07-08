"use client"

import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    useComboboxAnchor,
} from "@/components/ui/combobox"
import { type TimeGroup } from "@/hooks/use-time-groups"

export function TimeGroupsCombobox({
    timeGroups,
    value,
    onChange,
    className,
}: {
    timeGroups: TimeGroup[]
    value: string[]
    onChange: (value: string[]) => void
    className?: string
}) {
    const anchor = useComboboxAnchor()
    const selected = value
        .map((id) => timeGroups.find((g) => g.id === id))
        .filter((g): g is TimeGroup => !!g)

    return (
        <Combobox<TimeGroup, true>
            multiple
            items={timeGroups}
            value={selected}
            itemToStringLabel={(g) => g.name}
            isItemEqualToValue={(a, b) => a.id === b.id}
            onValueChange={(groups) => onChange(groups.map((g) => g.id))}
        >
            <ComboboxChips ref={anchor} className={className}>
                {selected.map((g) => (
                    <ComboboxChip key={g.id}>{g.name}</ComboboxChip>
                ))}
                <ComboboxChipsInput placeholder="Buscar grupos de horário..." />
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>
                    {timeGroups.length === 0
                        ? "Nenhum grupo de horário cadastrado para essa empresa"
                        : "Nenhum resultado para essa busca"}
                </ComboboxEmpty>
                <ComboboxList>
                    {(group: TimeGroup) => (
                        <ComboboxItem key={group.id} value={group}>
                            {group.name}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
