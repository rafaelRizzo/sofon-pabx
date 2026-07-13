"use client"

import { useEffect, useState } from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    fetchDestinationOptions,
    type FetchableDestinationType,
} from "@/components/RouteDestination/route-destination-field"
import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { type InboundRoute } from "@/hooks/use-inbound-routes"

type Props = {
    routes: InboundRoute[]
    loading: boolean
    companySelected: boolean
    onEdit: (route: InboundRoute) => void
    onDelete: (route: InboundRoute) => void
}

// Resolve o nome de cada destino buscando a lista de cada tipo presente nas rotas
// visíveis uma única vez (não por linha) — evita N requests repetidos pro mesmo recurso.
// loadedTypes existe pra diferenciar "ainda buscando" (mostra "…") de "buscou e não achou"
// (registro deletado/de outra empresa — mostra aviso em vez de ficar preso em "…" pra sempre).
// Agrupa por (tipo, empresa da própria rota) em vez de receber uma empresa fixa, já que a
// listagem pode mostrar rotas de "Todas as empresas" ao mesmo tempo
function useDestinationLabels(routes: InboundRoute[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const r of routes) {
            const t = r.destination?.type
            if (t && t !== "hangup") pairs.set(`${t}:${r.companyId}`, { type: t, companyId: r.companyId })
        }
        if (pairs.size === 0) return

        let cancelled = false
        Promise.all(
            [...pairs.values()].map(({ type, companyId }) =>
                fetchDestinationOptions(type, companyId).then(
                    (opts) => [type, opts] as const
                )
            )
        )
            .then((results) => {
                if (cancelled) return
                setLabels((prev) => {
                    const next = { ...prev }
                    for (const [t, opts] of results) {
                        for (const o of opts) next[`${t}:${o.id}`] = o.label
                    }
                    return next
                })
                setLoadedTypes((prev) => new Set([...prev, ...results.map(([t]) => t)]))
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [routes])

    return { labels, loadedTypes }
}

export function InboundRoutesTable({ routes, loading, companySelected, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(routes)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>DID</TableHead>
                        <TableHead>Tronco</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : routes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                {companySelected ? "Nenhuma rota de entrada encontrada" : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        routes.map((route) => (
                            <TableRow key={route.id}>
                                <TableCell className="font-medium">{route.name}</TableCell>
                                <TableCell>{route.did.number}</TableCell>
                                <TableCell>{route.trunk.name}</TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={route.destination}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => onEdit(route)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar rota</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(route)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar rota</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
