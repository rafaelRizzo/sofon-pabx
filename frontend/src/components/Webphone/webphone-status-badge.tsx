import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { WebphoneRegistrationStatus } from "@/hooks/use-webphone"

// Recipe de badge do projeto (ver presence-badge.tsx) - nunca bg-<cor>-500 cru nem border colorido.
const STATUS_CONFIG: Record<WebphoneRegistrationStatus, { label: string; className: string }> = {
    registered: {
        label: "Registrado",
        className: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300",
    },
    connecting: {
        label: "Conectando...",
        className: "bg-muted text-muted-foreground",
    },
    error: {
        label: "Erro",
        className: "bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300",
    },
}

export function WebphoneStatusBadge({ status }: { status: WebphoneRegistrationStatus }) {
    const { label, className } = STATUS_CONFIG[status]
    return <Badge className={cn("border-transparent", className)}>{label}</Badge>
}
