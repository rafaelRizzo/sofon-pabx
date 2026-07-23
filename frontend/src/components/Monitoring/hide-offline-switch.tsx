"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type Props = {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export function HideOfflineSwitch({ checked, onCheckedChange }: Props) {
    return (
        <div className="flex items-center gap-2">
            <Switch
                id="hide-offline"
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
            <Label htmlFor="hide-offline" className="text-sm font-normal">
                Ocultar offline
            </Label>
        </div>
    )
}
