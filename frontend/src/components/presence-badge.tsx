import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CallState, Presence } from "@/hooks/use-realtime"

const PRESENCE_CONFIG: Record<Presence, { label: string; className: string }> = {
    online: {
        label: "Online",
        className:
            "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    },
    offline: {
        label: "Offline",
        className:
            "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    },
    unknown: {
        label: "—",
        className: "border-transparent bg-muted text-muted-foreground",
    },
}

const CALL_STATE_CONFIG: Record<CallState, { label: string; className: string }> = {
    idle: {
        label: "Livre",
        className:
            "border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300",
    },
    ringing: {
        label: "Chamando",
        className:
            "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
    },
    in_call: {
        label: "Em chamada",
        className:
            "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    },
    busy: {
        label: "Ocupado",
        className:
            "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    },
    unavailable: {
        label: "Indisponível",
        className:
            "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    },
    unknown: {
        label: "—",
        className: "border-transparent bg-muted text-muted-foreground",
    },
}

export function PresenceBadge({
    presence,
    className,
}: {
    presence: Presence
    className?: string
}) {
    const config = PRESENCE_CONFIG[presence]
    return (
        <Badge variant="outline" className={cn(config.className, className)}>
            {config.label}
        </Badge>
    )
}

export function CallStateBadge({
    callState,
    className,
}: {
    callState: CallState
    className?: string
}) {
    const config = CALL_STATE_CONFIG[callState]
    return (
        <Badge variant="outline" className={cn(config.className, className)}>
            {config.label}
        </Badge>
    )
}
