"use client"

import { useEffect, useState } from "react"
import { HeadsetIcon, PencilIcon, StarIcon, Trash2Icon, UsersIcon } from "lucide-react"

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
import { type Company } from "@/hooks/use-companies"
import { QUEUE_STRATEGY_LABELS, type Queue } from "@/hooks/use-queues"

type Props = {
    queues: Queue[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (queue: Queue) => void
    onManageMembers: (queue: Queue) => void
    onDelete: (queue: Queue) => void
}

// Mesmo padrão de InboundRoutesTable/TimeConditionsTable: resolve o nome do destino buscando a
// lista de cada tipo presente uma única vez (não por linha) — evita N requests repetidos.
// Agrupa por (tipo, empresa da própria fila) em vez de receber uma empresa fixa, já que a
// listagem pode mostrar filas de "Todas as empresas" ao mesmo tempo
function useDestinationLabels(queues: Queue[]) {
    const [labels, setLabels] = useState<Record<string, string>>({})
    const [loadedTypes, setLoadedTypes] = useState<Set<FetchableDestinationType>>(new Set())

    useEffect(() => {
        const pairs = new Map<string, { type: FetchableDestinationType; companyId: string }>()
        for (const q of queues) {
            const t = q.postQueueDestination?.type
            if (t && t !== "hangup") pairs.set(`${t}:${q.companyId}`, { type: t, companyId: q.companyId })
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
    }, [queues])

    return { labels, loadedTypes }
}

export function QueuesTable({
    queues,
    companies,
    loading,
    companySelected,
    onEdit,
    onManageMembers,
    onDelete,
}: Props) {
    const { labels, loadedTypes } = useDestinationLabels(queues)
    const companyName = (companyId: string) =>
        companies.find((c) => c.id === companyId)?.name ?? companyId

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Estratégia</TableHead>
                        <TableHead>Destino pós-fila</TableHead>
                        <TableHead>Pesquisa</TableHead>
                        <TableHead>Callcenter</TableHead>
                        <TableHead className="w-38 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 8 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : queues.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                {companySelected ? "Nenhuma fila encontrada" : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        queues.map((queue) => (
                            <TableRow key={queue.id}>
                                <TableCell className="font-medium">{queue.name}</TableCell>
                                <TableCell>{queue.number}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{companyName(queue.companyId)}</Badge>
                                </TableCell>
                                <TableCell>{QUEUE_STRATEGY_LABELS[queue.strategy]}</TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={queue.postQueueDestination}
                                        labels={labels}
                                        loadedTypes={loadedTypes}
                                    />
                                </TableCell>
                                <TableCell>
                                    {queue.hasSurveyAudio ? (
                                        <Badge variant="outline" className="gap-1.5">
                                            <StarIcon className="size-3" />
                                            Ativa
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {queue.callcenterEnabled ? (
                                        <Badge variant="outline" className="gap-1.5">
                                            <HeadsetIcon className="size-3" />
                                            Ativo
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
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
                                                            onClick={() => onManageMembers(queue)}
                                                        >
                                                            <UsersIcon />
                                                            <span className="sr-only">Membros</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Gerenciar membros</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => onEdit(queue)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar fila</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(queue)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar fila</TooltipContent>
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
