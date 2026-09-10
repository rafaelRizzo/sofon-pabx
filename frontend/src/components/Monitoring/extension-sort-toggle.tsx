"use client"

import { Button } from "@/components/ui/button"
import { type ExtensionSortToggleProps } from "@/components/Monitoring/types"

export type ExtensionSortBy = "number" | "name"

export function ExtensionSortToggle({
    value,
    onValueChange,
}: ExtensionSortToggleProps) {
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
