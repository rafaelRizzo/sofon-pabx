"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { WEEKDAYS, type Weekday } from "@/hooks/use-time-groups"

export const WEEKDAY_LABELS: Record<Weekday, string> = {
    mon: "Seg",
    tue: "Ter",
    wed: "Qua",
    thu: "Qui",
    fri: "Sex",
    sat: "Sáb",
    sun: "Dom",
}

export function WeekdayCheckboxes({
    value,
    onChange,
    className,
}: {
    value: Weekday[]
    onChange: (value: Weekday[]) => void
    className?: string
}) {
    return (
        <ToggleGroup
            multiple
            variant="outline"
            value={value}
            onValueChange={(next) =>
                onChange(WEEKDAYS.filter((d) => next.includes(d)))
            }
            className={className}
        >
            {WEEKDAYS.map((day) => (
                <ToggleGroupItem
                    key={day}
                    value={day}
                    className="data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
                >
                    {WEEKDAY_LABELS[day]}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    )
}
