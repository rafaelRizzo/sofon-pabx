"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export const CODEC_OPTIONS = [
    "ulaw",
    "alaw",
    "g729",
    "g722",
    "gsm",
    "opus",
    "speex",
    "ilbc",
] as const

function parseCodecs(value: string): string[] {
    return value
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
}

export function CodecCheckboxes({
    value,
    onChange,
    className,
}: {
    value: string
    onChange: (value: string) => void
    className?: string
}) {
    const selected = parseCodecs(value ?? "")
    const extras = selected.filter(
        (c) => !(CODEC_OPTIONS as readonly string[]).includes(c)
    )

    function toggle(codec: string, checked: boolean) {
        const next = checked
            ? [...selected, codec]
            : selected.filter((c) => c !== codec)
        const ordered = [
            ...CODEC_OPTIONS.filter((c) => next.includes(c)),
            ...next.filter((c) => !(CODEC_OPTIONS as readonly string[]).includes(c)),
        ]
        onChange(ordered.join(","))
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {CODEC_OPTIONS.map((codec) => (
                    <label
                        key={codec}
                        className="flex items-center gap-2 text-sm font-normal"
                    >
                        <Checkbox
                            checked={selected.includes(codec)}
                            onCheckedChange={(checked) =>
                                toggle(codec, checked === true)
                            }
                        />
                        {codec}
                    </label>
                ))}
            </div>
            {extras.length > 0 && (
                <p className="text-muted-foreground text-xs">
                    Outros: {extras.join(", ")}
                </p>
            )}
        </div>
    )
}
