"use client"

import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { type DidUsedByRef } from "@/hooks/use-dids"

interface DidRoutedToBadgeProps {
    usedBy: DidUsedByRef[]
}

// Pra onde a chamada desse DID está indo - resolvido a partir da(s) Inbound Route(s) que o
// referenciam (didId), nunca do DID em si (ele não é um tipo de route destination). Normalmente 1
// rota só; mais de uma acontece quando o mesmo número é reaproveitado em troncos diferentes
// (UNIQUE é (trunkId, didId), não só didId).
export function DidRoutedToBadge({ usedBy }: DidRoutedToBadgeProps) {
    if (usedBy.length === 0)
        return (
            <span className="text-xs text-muted-foreground">
                Sem rota de entrada
            </span>
        )

    const [first, ...rest] = usedBy

    return (
        <TooltipProvider delay={100}>
            <div className="flex items-center gap-1.5">
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <span>
                                <RouteDestinationBadge
                                    destination={first!.destination}
                                />
                            </span>
                        }
                    />
                    <TooltipContent>{first!.name}</TooltipContent>
                </Tooltip>
                {rest.length > 0 && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Badge variant="outline">
                                    +{rest.length}
                                </Badge>
                            }
                        />
                        <TooltipContent>
                            <ul className="flex flex-col gap-0.5">
                                {rest.map((ref) => (
                                    <li key={ref.inboundRouteId}>
                                        {ref.name}
                                    </li>
                                ))}
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    )
}
