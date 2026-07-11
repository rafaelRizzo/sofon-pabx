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
import { type HttpMethod, type RequestTemplate } from "@/hooks/use-request-templates"

const METHOD_BADGE_CLASS: Record<HttpMethod, string> = {
    GET: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    POST: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    PUT: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    PATCH: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    DELETE: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
}

// Mesmo padrão de TimeConditionsTable: resolve o nome de cada destino buscando a lista de cada
// tipo presente uma única vez (não por linha/campo), olhando onSuccess e onError
function useDestinationLabels(requestTemplates: RequestTemplate[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const rt of requestTemplates) {
            for (const dest of [rt.onSuccess, rt.onError]) {
                const t = dest?.type
                if (t && t !== "hangup") pairs.set(`${t}:${rt.companyId}`, { type: t, companyId: rt.companyId })
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
    }, [requestTemplates])

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

type Props = {
    requestTemplates: RequestTemplate[]
    loading: boolean
    onEdit: (requestTemplate: RequestTemplate) => void
    onDelete: (requestTemplate: RequestTemplate) => void
}

export function RequestTemplatesTable({ requestTemplates, loading, onEdit, onDelete }: Props) {
    const { labels, loadedTypes } = useDestinationLabels(requestTemplates)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Requisição</TableHead>
                        <TableHead>Variáveis</TableHead>
                        <TableHead>Sucesso</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 6 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : requestTemplates.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                Nenhum template de requisição encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        requestTemplates.map((rt) => (
                            <TableRow key={rt.id}>
                                <TableCell className="font-medium">{rt.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={METHOD_BADGE_CLASS[rt.method]}>
                                            {rt.method}
                                        </Badge>
                                        <span className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                                            {rt.url}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {rt.variableMappings.length > 0 ? (
                                        <Badge variant="secondary">{rt.variableMappings.length}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={rt.onSuccess}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                    />
                                </TableCell>
                                <TableCell>
                                    <DestinationBadge
                                        destination={rt.onError}
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
                                                            onClick={() => onEdit(rt)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar template</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(rt)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar template</TooltipContent>
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
