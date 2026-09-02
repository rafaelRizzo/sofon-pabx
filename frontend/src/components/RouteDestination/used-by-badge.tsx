"use client"

import { LinkIcon, UnlinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export type UsedByRef = {
    sourceType: string
    sourceId: string
    slot: string
    label: string
}

interface UsedByBadgeProps {
    usedBy: UsedByRef[]
}

// Indicador de reaproveitamento - quantos outros fluxos apontam pra este registro como destino.
// Vazio = badge neutro "Não utilizado", pra deixar claro que o registro está ocioso em vez de
// deixar a célula em branco (ambíguo com "ainda carregando"/erro). Label já vem resolvido do
// backend (ver flow-reference-label.ts), sem fetch client-side nem estado de loading por linha -
// mesma filosofia do RouteDestinationBadge.
export function UsedByBadge({ usedBy }: UsedByBadgeProps) {
    if (usedBy.length === 0) {
        return (
            <Badge
                variant="outline"
                className="gap-1.5 border-transparent bg-muted text-muted-foreground"
            >
                <UnlinkIcon className="size-3" />
                Não é destino de nada
            </Badge>
        )
    }

    return (
        <TooltipProvider delay={100}>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Badge
                            variant="outline"
                            className="gap-1.5 border-transparent bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300"
                        >
                            <LinkIcon className="size-3" />
                            Usado em {usedBy.length}{" "}
                            {usedBy.length === 1 ? "lugar" : "lugares"}
                        </Badge>
                    }
                />
                <TooltipContent>
                    <ul className="flex flex-col gap-0.5">
                        {usedBy.map((ref) => (
                            <li
                                key={`${ref.sourceType}:${ref.sourceId}:${ref.slot}`}
                            >
                                {ref.label}
                            </li>
                        ))}
                    </ul>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
