"use client"

import {
    // HeadsetIcon, // Callcenter temporariamente removido da UI
    PencilIcon,
    StarIcon,
    Trash2Icon,
    UsersIcon,
} from "lucide-react"

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
import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { UsedByBadge } from "@/components/RouteDestination/used-by-badge"
import { QUEUE_STRATEGY_LABELS } from "@/hooks/use-queues"
import { type QueuesTableProps } from "@/components/Queues/types"

export function QueuesTable({
    queues,
    companies,
    loading,
    companySelected,
    onEdit,
    onManageMembers,
    onDelete,
}: QueuesTableProps) {
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
                        <TableHead>Usado por</TableHead>
                        <TableHead>Pesquisa</TableHead>
                        {/* Callcenter temporariamente removido da UI - ver células comentadas abaixo */}
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
                            <TableCell
                                colSpan={8}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhuma fila encontrada"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        queues.map((queue) => (
                            <TableRow key={queue.id}>
                                <TableCell className="font-medium">
                                    {queue.name}
                                </TableCell>
                                <TableCell>{queue.number}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {companyName(queue.companyId)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {QUEUE_STRATEGY_LABELS[queue.strategy]}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={queue.postQueueDestination}
                                    />
                                </TableCell>
                                <TableCell>
                                    <UsedByBadge usedBy={queue.usedBy} />
                                </TableCell>
                                <TableCell>
                                    {queue.hasSurveyAudio ? (
                                        <Badge
                                            variant="outline"
                                            className="gap-1.5 border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300"
                                        >
                                            <StarIcon className="size-3" />
                                            Ativa
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                {/* Callcenter temporariamente removido da UI
                                <TableCell>
                                    {queue.callcenterEnabled ? (
                                        <Badge
                                            variant="outline"
                                            className="gap-1.5"
                                        >
                                            <HeadsetIcon className="size-3" />
                                            Ativo
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                */}
                                <TableCell>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onManageMembers(
                                                                    queue
                                                                )
                                                            }
                                                        >
                                                            <UsersIcon />
                                                            <span className="sr-only">
                                                                Membros
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Gerenciar membros
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onEdit(queue)
                                                            }
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">
                                                                Editar
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Editar fila
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(queue)
                                                            }
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">
                                                                Deletar
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Deletar fila
                                                </TooltipContent>
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
