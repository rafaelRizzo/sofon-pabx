import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Recipe de badge do projeto (ver presence-badge.tsx) - nunca bg-<cor>-500 cru nem border colorido.
export function WebphoneStatusBadge({ registered }: { registered: boolean }) {
    return (
        <Badge
            className={cn(
                "border-transparent",
                registered
                    ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
            )}
        >
            {registered ? "Registrado" : "Conectando..."}
        </Badge>
    )
}
