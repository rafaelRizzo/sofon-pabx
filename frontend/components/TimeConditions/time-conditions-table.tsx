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
    type FetchableDestinationType,
} from "@/components/RouteDestination/route-destination-field"
import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { type TimeCondition } from "@/hooks/use-time-conditions"

type Props = {
    timeConditions: TimeCondition[]
    loading: boolean
    companySelected: boolean
    onEdit: (timeCondition: TimeCondition) => void
    onDelete: (timeCondition: TimeCondition) => void
}

// Mesmo padrão de InboundRoutesTable: resolve o nome de cada destino buscando a lista de
// cada tipo presente uma única vez (não por linha/campo) — aqui olhando trueRoute e falseRoute.
// Agrupa por (tipo, empresa da própria condição) em vez de receber uma empresa fixa, já que a
// listagem pode mostrar condições de "Todas as empresas" ao mesmo tempo
function useDestinationLabels(timeConditions: TimeCondition[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const tc of timeConditions) {
            for (const dest of [tc.trueRoute, tc.falseRoute]) {
                const t = dest?.type
                if (t && t !== "hangup") pairs.set(`${t}:${tc.companyId}`, { type: t, companyId: tc.companyId })
            }
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
    }, [timeConditions])

    return { labels, loadedTypes }
}

export function TimeConditionsTable({ timeConditions, loading, companySelected, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(timeConditions)

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
                                {companySelected ? "Nenhuma condição de horário encontrada" : "Selecione uma empresa para listar"}
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
                                    <RouteDestinationBadge
                                        destination={tc.trueRoute}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                        tone="true"
                                    />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={tc.falseRoute}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                        tone="false"
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
