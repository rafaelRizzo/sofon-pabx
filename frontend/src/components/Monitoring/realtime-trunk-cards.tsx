"use client"

import { NetworkIcon } from "lucide-react"

import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PresenceBadge } from "@/components/presence-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { RealtimeTrunk } from "@/hooks/use-realtime"

type Props = {
    trunks: RealtimeTrunk[]
    loading: boolean
    companySelected: boolean
}

// Cor do ícone por tipo de tronco: reforça a distinção pjsip (padrão) / sip (legado,
// ver project_sip_peers_legacy) / iax (alternativo) sem precisar de badge extra por card.
const TYPE_ACCENT: Record<string, string> = {
    pjsip: "bg-sky-500/15 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300",
    sip: "bg-slate-500/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300",
    iax: "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300",
}

export function RealtimeTrunkCards({ trunks, loading, companySelected }: Props) {
    if (loading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} size="sm">
                        <CardHeader className="gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        )
    }

    if (trunks.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {companySelected
                    ? "Nenhum tronco encontrado"
                    : "Selecione uma empresa para listar"}
            </p>
        )
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trunks.map((trunk) => (
                <Card key={trunk.id} size="sm">
                    <CardHeader>
                        <CardTitle className="flex min-w-0 items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-md",
                                        TYPE_ACCENT[trunk.type] ??
                                            "bg-muted text-muted-foreground"
                                    )}
                                >
                                    <NetworkIcon className="size-3.5" />
                                </span>
                                <span className="truncate">{trunk.name}</span>
                            </span>
                            <PresenceBadge presence={trunk.presence} />
                        </CardTitle>
                        <CardDescription className="pl-8">
                            <Badge variant="outline">
                                {trunk.type.toUpperCase()}
                            </Badge>
                        </CardDescription>
                    </CardHeader>
                </Card>
            ))}
        </div>
    )
}
