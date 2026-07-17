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
import { VARIABLE_RULE_OPERATOR_LABELS, type VariableCondition } from "@/hooks/use-variable-conditions"

type Props = {
    variableConditions: VariableCondition[]
    loading: boolean
    companySelected: boolean
    onEdit: (variableCondition: VariableCondition) => void
    onDelete: (variableCondition: VariableCondition) => void
}

export function VariableConditionsTable({ variableConditions, loading, companySelected, onEdit, onDelete }: Props) {
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
                                {companySelected ? "Nenhuma condição de variável encontrada" : "Selecione uma empresa para listar"}
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
                                    <RouteDestinationBadge destination={vc.trueRoute} tone="true" />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge destination={vc.falseRoute} tone="false" />
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
