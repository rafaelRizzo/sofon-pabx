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
import { VARIABLE_RULE_OPERATOR_LABELS, type VariableCondition } from "@/hooks/use-variable-conditions"

type Props = {
    variableConditions: VariableCondition[]
    loading: boolean
    onEdit: (variableCondition: VariableCondition) => void
    onDelete: (variableCondition: VariableCondition) => void
}

// Mesmo padrão de TimeConditionsTable: resolve o nome de cada destino buscando a lista de cada
// tipo presente uma única vez (não por linha) — aqui olhando trueRoute e falseRoute. Agrupa por
// (tipo, empresa da própria condição), já que a listagem pode mostrar condições de "Todas as
// empresas" ao mesmo tempo
function useDestinationLabels(variableConditions: VariableCondition[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const vc of variableConditions) {
            for (const dest of [vc.trueRoute, vc.falseRoute]) {
                const t = dest?.type
                if (t && t !== "hangup") pairs.set(`${t}:${vc.companyId}`, { type: t, companyId: vc.companyId })
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
    }, [variableConditions])

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

export function VariableConditionsTable({ variableConditions, loading, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(variableConditions)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Regras</TableHead>
                        <TableHead>Se verdadeiro</TableHead>
                        <TableHead>Se falso</TableHead>
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
                    ) : variableConditions.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                Nenhuma condição de variável encontrada
                            </TableCell>
                        </TableRow>
                    ) : (
                        variableConditions.map((vc) => (
                            <TableRow key={vc.id}>
                                <TableCell className="font-medium">{vc.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {vc.rules.map((r, i) => (
                                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                                                {r.variable} {VARIABLE_RULE_OPERATOR_LABELS[r.operator]}
                                                {r.value ? ` ${r.value}` : ""}
                                            </Badge>
                                        ))}
                                    </div>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        Combinador: {vc.combinator === "and" ? "E" : "OU"}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={vc.trueRoute}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                    />
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={vc.falseRoute}
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
                                                            onClick={() => onEdit(vc)}
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
                                                            onClick={() => onDelete(vc)}
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
