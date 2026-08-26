"use client"

import { DownloadIcon, PencilIcon, Trash2Icon, WorkflowIcon } from "lucide-react"

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
import { type Flow } from "@/hooks/use-flows"

type Props = {
    flows: Flow[]
    loading: boolean
    companySelected: boolean
    onOpen: (flow: Flow) => void
    onEdit: (flow: Flow) => void
    onDelete: (flow: Flow) => void
    onExport: (flow: Flow) => void
    exporting: boolean
}

export function FlowsTable({
    flows,
    loading,
    companySelected,
    onOpen,
    onEdit,
    onDelete,
    onExport,
    exporting,
}: Props) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Usado por</TableHead>
                        <TableHead className="w-40 text-right">Ações</TableHead>
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
                    ) : flows.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum flow encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        flows.map((flow) => (
                            <TableRow
                                key={flow.id}
                                className="cursor-pointer"
                                onClick={() => onOpen(flow)}
                            >
                                <TableCell className="font-medium">
                                    {flow.name}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={flow.entryDestination}
                                    />
                                </TableCell>
                                <TableCell>
                                    <UsedByBadge usedBy={flow.usedBy} />
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onOpen(flow)
                                                            }
                                                        >
                                                            <WorkflowIcon />
                                                            <span className="sr-only">
                                                                Abrir canvas
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Abrir canvas
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onEdit(flow)
                                                            }
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">
                                                                Renomear
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Renomear flow
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            disabled={exporting}
                                                            onClick={() =>
                                                                onExport(flow)
                                                            }
                                                        >
                                                            <DownloadIcon />
                                                            <span className="sr-only">
                                                                Exportar
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Exportar flow
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(flow)
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
                                                    Deletar flow
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
