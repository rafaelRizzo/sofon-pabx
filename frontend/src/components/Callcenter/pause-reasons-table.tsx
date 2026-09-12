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
import { type PauseReasonsTableProps } from "@/components/Callcenter/types"

export function PauseReasonsTable({
    pauseReasons,
    loading,
    onEdit,
    onDelete,
}: PauseReasonsTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 3 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : pauseReasons.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={3}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhum motivo de pausa cadastrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        pauseReasons.map((reason) => (
                            <TableRow key={reason.id}>
                                <TableCell className="font-medium">
                                    {reason.label}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            reason.active ? "default" : "outline"
                                        }
                                    >
                                        {reason.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onEdit(reason)}
                                        >
                                            <PencilIcon />
                                            <span className="sr-only">
                                                Editar
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onDelete(reason)}
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
