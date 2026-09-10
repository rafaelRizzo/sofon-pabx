"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRightIcon, NetworkIcon } from "lucide-react"

import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PresenceBadge } from "@/components/presence-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useRealtimeTrunks } from "@/hooks/use-realtime"

type Props = {
    companyId: string | undefined
}

export function DashboardTrunksStatus({ companyId }: Props) {
    const { trunks, loading } = useRealtimeTrunks(companyId)
    const sorted = [...trunks].sort((a, b) => a.name.localeCompare(b.name))
    const online = trunks.filter((t) => t.presence === "online").length

    return (
        <Card>
            <CardHeader>
                <CardTitle>Troncos</CardTitle>
                <CardAction>
                    <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link to="/dashboard/monitoring" />}
                    >
                        Ver tudo
                        <ArrowRightIcon />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                {!companyId ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Selecione uma empresa para ver os troncos
                    </p>
                ) : loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))
                ) : sorted.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum tronco cadastrado
                    </p>
                ) : (
                    <>
                        <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                            {online} de {sorted.length} online
                        </p>
                        {sorted.map((trunk) => (
                            <div
                                key={trunk.id}
                                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <NetworkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate font-medium">
                                        {trunk.name}
                                    </span>
                                    <Badge variant="outline" className="shrink-0">
                                        {trunk.type.toUpperCase()}
                                    </Badge>
                                </span>
                                <PresenceBadge
                                    presence={trunk.presence}
                                    className="shrink-0"
                                />
                            </div>
                        ))}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
