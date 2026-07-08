"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export const MONTH_OPTIONS = [
    { value: "jan", label: "Janeiro" },
    { value: "feb", label: "Fevereiro" },
    { value: "mar", label: "Março" },
    { value: "apr", label: "Abril" },
    { value: "may", label: "Maio" },
    { value: "jun", label: "Junho" },
    { value: "jul", label: "Julho" },
    { value: "aug", label: "Agosto" },
    { value: "sep", label: "Setembro" },
    { value: "oct", label: "Outubro" },
    { value: "nov", label: "Novembro" },
    { value: "dec", label: "Dezembro" },
]

function parseRange(value: string): [string, string] {
    if (!value || value === "*") return ["", ""]
    const [start, end] = value.split("-")
    return [start, end ?? ""]
}

export function MonthsField({
    value,
    onChange,
}: {
    value: string
    onChange: (value: string) => void
}) {
    const isAll = value === "*" || !value
    const [start, end] = parseRange(value)

    function setRange(nextStart: string, nextEnd: string) {
        if (!nextStart) return onChange("jan")
        onChange(nextEnd && nextEnd !== nextStart ? `${nextStart}-${nextEnd}` : nextStart)
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-normal">
                <Switch
                    checked={isAll}
                    onCheckedChange={(checked) => onChange(checked ? "*" : "jan")}
                />
                Todos os meses
            </label>
            {!isAll && (
                <div className="flex items-center gap-2">
                    <Select
                        items={MONTH_OPTIONS}
                        value={start}
                        onValueChange={(v) => setRange(v ?? "", end)}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="De" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_OPTIONS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">até (opcional)</span>
                    <Select
                        items={MONTH_OPTIONS}
                        value={end}
                        onValueChange={(v) => setRange(start, v ?? "")}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Até" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_OPTIONS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    )
}
