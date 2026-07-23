"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    ROUTE_DEST_ICONS,
    ROUTE_DEST_LABELS,
    type RouteDestination,
    type RouteDestinationType,
} from "@/components/RouteDestination/route-destination-field"

type DestinationTone = "true" | "false" | "neutral"

const TONE_CLASSES: Record<DestinationTone, string> = {
    true: "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    false: "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    neutral:
        "border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300",
}

interface RouteDestinationBadgeProps {
    destination: RouteDestination
    tone?: DestinationTone
}

// O nome legível (label) já vem resolvido do backend (ver route-destination-label.ts) — sem
// fetch client-side, sem estado de "carregando"/"registro não encontrado" pra gerenciar aqui.
export function RouteDestinationBadge({
    destination,
    tone = "neutral",
}: RouteDestinationBadgeProps) {
    const type: RouteDestinationType = destination?.type ?? "hangup"
    const Icon = ROUTE_DEST_ICONS[type]
    const detail =
        destination && "label" in destination ? destination.label : null

    return (
        <Badge variant="outline" className={cn("gap-1.5", TONE_CLASSES[tone])}>
            <Icon className="size-3" />
            {ROUTE_DEST_LABELS[type]}
            {detail && <span className="opacity-70">- {detail}</span>}
        </Badge>
    )
}
