"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"

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
import { type User, type UserRole } from "@/hooks/use-users"

const ROLE_LABELS: Record<UserRole, string> = {
    admin: "Administrador",
    reseller: "Revenda",
    user: "Usuário",
}

type UsersTableProps = {
    users: User[]
    loading: boolean
    onEdit: (user: User) => void
    onDelete: (user: User) => void
}

export function UsersTable({
    users,
    loading,
    onEdit,
    onDelete,
}: UsersTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Permissão</TableHead>
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
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhum usuário encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                    {user.name}
                                </TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            user.role === "admin"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {ROLE_LABELS[user.role]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={user.status} />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onEdit(user)}
                                        >
                                            <PencilIcon />
                                            <span className="sr-only">
                                                Editar
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onDelete(user)}
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
