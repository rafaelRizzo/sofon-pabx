"use client"

import { PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
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

type CompaniesTableProps = {
    companies: Company[]
    loading: boolean
    onEdit: (company: Company) => void
    onDelete: (company: Company) => void
    onResyncDialplan: (company: Company) => void
}

export function CompaniesTable({
    companies,
    loading,
    onEdit,
    onDelete,
    onResyncDialplan,
}: CompaniesTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Fuso horário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
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
                    ) : companies.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhuma empresa encontrada
                            </TableCell>
                        </TableRow>
                    ) : (
                        companies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell className="font-medium">
                                    {company.name}
                                </TableCell>
                                <TableCell>
                                    {company.doc || (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {company.timezone}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={company.status} />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <TooltipProvider delay={200}>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onResyncDialplan(
                                                                    company
                                                                )
                                                            }
                                                        >
                                                            <RefreshCwIcon />
                                                            <span className="sr-only">
                                                                Resincronizar
                                                                dialplan
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Regenera todo o dialplan
                                                    estático da empresa a
                                                    partir do banco
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onEdit(company)}
                                        >
                                            <PencilIcon />
                                            <span className="sr-only">
                                                Editar
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onDelete(company)}
                                        >
                                            <Trash2Icon />
                                            <span className="sr-only">
                                                Deletar
                                            </span>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
