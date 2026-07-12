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
import { type VariableSet } from "@/hooks/use-variables"

type Props = {
    variableSets: VariableSet[]
    loading: boolean
    onEdit: (variableSet: VariableSet) => void
    onDelete: (variableSet: VariableSet) => void
}

// Mesmo padrão de InboundRoutesTable: resolve o nome do destino buscando a lista de cada tipo
// presente uma única vez (não por linha) — agrupa por (tipo, empresa da própria variável),
// já que a listagem pode mostrar registros de "Todas as empresas" ao mesmo tempo
function useDestinationLabels(variableSets: VariableSet[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const v of variableSets) {
            const t = v.destination?.type
            if (t && t !== "hangup") pairs.set(`${t}:${v.companyId}`, { type: t, companyId: v.companyId })
        }
        if (pairs.size === 0) return

        let cancelled = false
        Promise.all(
            [...pairs.values()].map(({ type, companyId }) =>
                fetchDestinationOptions(type, companyId).then((opts) => [type, opts] as const)
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
    }, [variableSets])

    return { labels, loadedTypes }
}

function DestinationCell({
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

export function VariableSetsTable({ variableSets, loading, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(variableSets)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Atribuições</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : variableSets.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                Nenhuma variável encontrada
                            </TableCell>
                        </TableRow>
                    ) : (
                        variableSets.map((v) => (
                            <TableRow key={v.id}>
                                <TableCell className="font-medium">{v.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {v.assignments.map((a, i) => (
                                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                                                {a.variable}={a.value}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <DestinationCell
                                        destination={v.destination}
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
                                                            onClick={() => onEdit(v)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar variável</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(v)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar variável</TooltipContent>
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
