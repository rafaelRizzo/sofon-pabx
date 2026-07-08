"use client"

import { useEffect, useState } from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
    ROUTE_DEST_ICONS,
    ROUTE_DEST_LABELS,
    type FetchableDestinationType,
    type RouteDestination,
    type RouteDestinationType,
} from "@/components/RouteDestination/route-destination-field"
import { type TimeCondition } from "@/hooks/use-time-conditions"

type Props = {
    timeConditions: TimeCondition[]
    loading: boolean
    companyId: string
    onEdit: (timeCondition: TimeCondition) => void
    onDelete: (timeCondition: TimeCondition) => void
}

// Mesmo padrão de InboundRoutesTable: resolve o nome de cada destino buscando a lista de
// cada tipo presente uma única vez (não por linha/campo) — aqui olhando trueRoute e falseRoute
function useDestinationLabels(timeConditions: TimeCondition[], companyId: string) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        if (!companyId) return
        const types = new Set<FetchableDestinationType>()
        for (const tc of timeConditions) {
            for (const dest of [tc.trueRoute, tc.falseRoute]) {
                const t = dest?.type
                if (t && t !== "hangup") types.add(t)
            }
        }
        if (types.size === 0) return

        let cancelled = false
        Promise.all(
            [...types].map((t) => fetchDestinationOptions(t, companyId).then((opts) => [t, opts] as const))
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
    }, [timeConditions, companyId])

    return { labels, loadedTypes }
}

function DestinationBadge({
    destination,
    labels,
    loadedTypes,
}: {
    destination: RouteDestination
    labels: Record<string, string>
    loadedTypes: Set<FetchableDestinationType>
}) {
    const type: RouteDestinationType = destination?.type ?? "hangup"
    const Icon = ROUTE_DEST_ICONS[type]

    let detail: string | null = null
    if (destination && "id" in destination) {
        const key = `${type}:${destination.id}`
        if (labels[key]) detail = labels[key]
        else if (loadedTypes.has(type as FetchableDestinationType)) detail = "registro não encontrado"
        else detail = "…"
    }

    return (
        <Badge variant="outline" className="gap-1.5">
            <Icon className="size-3" />
            {ROUTE_DEST_LABELS[type]}
            {detail && <span className="text-muted-foreground">— {detail}</span>}
        </Badge>
    )
}

export function TimeConditionsTable({ timeConditions, loading, companyId, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(timeConditions, companyId)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Grupos de horário</TableHead>
                        <TableHead>Dentro do horário</TableHead>
                        <TableHead>Fora do horário</TableHead>
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
                    ) : timeConditions.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                Nenhuma condição de horário encontrada
                            </TableCell>
                        </TableRow>
                    ) : (
                        timeConditions.map((tc) => (
                            <TableRow key={tc.id}>
                                <TableCell className="font-medium">{tc.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {tc.timeGroups.map(({ timeGroup }) => (
                                            <Badge key={timeGroup.id} variant="secondary">
                                                {timeGroup.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={tc.trueRoute}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                    />
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={tc.falseRoute}
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
                                                            onClick={() => onEdit(tc)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar condição</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(tc)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar condição</TooltipContent>
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
