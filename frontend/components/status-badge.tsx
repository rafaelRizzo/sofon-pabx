import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    active: {
        label: "Ativo",
        className:
            "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    },
    inactive: {
        label: "Inativo",
        className: "border-transparent bg-muted text-muted-foreground",
    },
    blocked: {
        label: "Bloqueado",
        className:
            "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    },
}

type StatusBadgeProps = {
    status: string
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] ?? { label: status, className: "" }

    return (
        <Badge variant="outline" className={cn(config.className, className)}>
            {config.label}
        </Badge>
    )
}
