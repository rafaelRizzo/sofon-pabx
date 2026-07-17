"use client"

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
import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { type TimeCondition } from "@/hooks/use-time-conditions"

type Props = {
    timeConditions: TimeCondition[]
    loading: boolean
    companySelected: boolean
    onEdit: (timeCondition: TimeCondition) => void
    onDelete: (timeCondition: TimeCondition) => void
}

export function TimeConditionsTable({ timeConditions, loading, companySelected, onEdit, onDelete }: Props) {
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
                                    <RouteDestinationBadge destination={tc.trueRoute} tone="true" />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge destination={tc.falseRoute} tone="false" />
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
