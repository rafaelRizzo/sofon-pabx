"use client"

import { Button } from "@/components/ui/button"

export type ExtensionSortBy = "number" | "name"

type Props = {
    value: ExtensionSortBy
    onValueChange: (value: ExtensionSortBy) => void
}

export function ExtensionSortToggle({ value, onValueChange }: Props) {
    return (
        <div className="inline-flex rounded-md border p-0.5">
            <Button
                type="button"
                size="sm"
                variant={value === "number" ? "secondary" : "ghost"}
                onClick={() => onValueChange("number")}
            >
                Número
            </Button>
            <Button
                type="button"
                size="sm"
                variant={value === "name" ? "secondary" : "ghost"}
                onClick={() => onValueChange("name")}
            >
                Nome
            </Button>
        </div>
    )
}
