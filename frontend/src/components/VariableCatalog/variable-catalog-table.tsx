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
import { type Company } from "@/hooks/use-companies"
import { type Variable } from "@/hooks/use-variable-catalog"

type Props = {
    variables: Variable[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (variable: Variable) => void
    onDelete: (variable: Variable) => void
}

export function VariableCatalogTable({
    variables,
    companies,
    loading,
    companySelected,
    onEdit,
    onDelete,
}: Props) {
    const companyName = (companyId: string) =>
        companies.find((c) => c.id === companyId)?.name ?? companyId

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Descrição</TableHead>
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
                    ) : variables.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhuma variável cadastrada"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        variables.map((variable) => (
                            <TableRow key={variable.id}>
                                <TableCell className="font-mono text-sm font-medium">
                                    {variable.name}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {companyName(variable.companyId)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {variable.description ?? "-"}
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
                                                            onClick={() =>
                                                                onEdit(variable)
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
                                                    Editar variável
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(variable)
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
                                                    Deletar variável
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
