import { cn } from "@/lib/utils"

// Pulso "ao vivo": sinaliza dado fresco via SSE (push do AMI, não polling) e é reaproveitado
// como indicador de urgência (ex: chamadas aguardando > 0) — mesma linguagem visual pros dois
// significados ("isso está atualizando agora" / "isso precisa de atenção agora").
export function LiveDot({
    active = true,
    className,
}: {
    active?: boolean
    className?: string
}) {
    return (
        <span className={cn("relative inline-flex size-2", className)}>
            {active && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
                className={cn(
                    "relative inline-flex size-2 rounded-full",
                    active ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
            />
        </span>
    )
}

export function LiveBadge({ active = true }: { active?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <LiveDot active={active} />
            {active ? "Ao vivo" : "Sem dados"}
        </span>
    )
}
