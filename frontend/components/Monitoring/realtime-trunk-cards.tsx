"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PresenceBadge } from "@/components/presence-badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { RealtimeTrunk } from "@/hooks/use-realtime"

type Props = {
    trunks: RealtimeTrunk[]
    loading: boolean
    companySelected: boolean
}

export function RealtimeTrunkCards({ trunks, loading, companySelected }: Props) {
    if (loading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} size="sm">
                        <CardHeader>
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trunks.map((trunk) => (
                <Card key={trunk.id} size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>{trunk.name}</span>
                            <PresenceBadge presence={trunk.presence} />
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5">
                            <Badge
                                variant={
                                    trunk.type === "pjsip"
                                        ? "secondary"
                                        : "outline"
                                }
                            >
                                {trunk.type.toUpperCase()}
                            </Badge>
                            <Badge
                                variant={
                                    trunk.registrationMode === "outbound"
                                        ? "secondary"
                                        : "outline"
                                }
                            >
                                {trunk.registrationMode === "outbound"
                                    ? "Outbound"
                                    : "Inbound"}
                            </Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <span className="text-xs text-muted-foreground">
                            {trunk.expirySeconds
                                ? `Registro a cada ${trunk.expirySeconds}s`
                                : "—"}
                        </span>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
