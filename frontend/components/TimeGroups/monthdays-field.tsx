"use client"

import { NumberInput } from "@/components/ui/number-input"
import { Switch } from "@/components/ui/switch"

function parseRange(value: string): [string, string] {
    if (!value || value === "*") return ["", ""]
    const [start, end] = value.split("-")
    return [start, end ?? ""]
}

export function MonthdaysField({
    value,
    onChange,
}: {
    value: string
    onChange: (value: string) => void
}) {
    const isAll = value === "*" || !value
    const [start, end] = parseRange(value)

    function setRange(nextStart: string, nextEnd: string) {
        if (!nextStart) return onChange("1")
        onChange(nextEnd && nextEnd !== nextStart ? `${nextStart}-${nextEnd}` : nextStart)
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-normal">
                <Switch
                    checked={isAll}
                    onCheckedChange={(checked) => onChange(checked ? "*" : "1")}
                />
                Todos os dias do mês
            </label>
            {!isAll && (
                <div className="flex items-center gap-2">
                    <NumberInput
                        min={1}
                        max={31}
                        placeholder="Dia"
                        className="w-20"
                        value={start}
                        onChange={(e) => setRange(e.target.value, end)}
                    />
                    <span className="text-xs text-muted-foreground">até (opcional)</span>
                    <NumberInput
                        min={1}
                        max={31}
                        placeholder="Dia"
                        className="w-20"
                        value={end}
                        onChange={(e) => setRange(start, e.target.value)}
                    />
                </div>
            )}
        </div>
    )
}
