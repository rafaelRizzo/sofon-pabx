"use client"

import {
    CheckIcon,
    PencilIcon,
    RotateCcwIcon,
    Trash2Icon,
    XIcon,
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
import { type Company } from "@/hooks/use-companies"
import { type Extension } from "@/hooks/use-extensions"

type Props = {
    extensions: Extension[]
    companies: Company[]
    loading: boolean
    onEdit: (extension: Extension) => void
    onResetPassword: (extension: Extension) => void
    onDelete: (extension: Extension) => void
}

export function ExtensionsTable({
    extensions,
    companies,
    loading,
    onEdit,
    onResetPassword,
    onDelete,
}: Props) {
    const getCompanyName = (companyId: string) =>
        companies.find((c) => c.id === companyId)?.name ?? companyId

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ramal</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-center">Saída</TableHead>
                        <TableHead className="w-30" />
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
                    ) : extensions.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhum ramal encontrado
                            </TableCell>
                        </TableRow>
                    ) : (
                        extensions.map((ext) => (
                            <TableRow key={ext.id}>
                                <TableCell className="font-mono font-medium">
                                    {ext.alias}
                                </TableCell>
                                <TableCell>{ext.name}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            ext.type === "pjsip"
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {ext.type.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {getCompanyName(ext.companyId)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    {ext.allowOutbound ? (
                                        <CheckIcon className="mx-auto size-4 text-emerald-500" />
                                    ) : (
                                        <XIcon className="mx-auto size-4 text-muted-foreground" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onEdit(ext)}
                                        >
                                            <PencilIcon />
                                            <span className="sr-only">
                                                Editar
                                            </span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onResetPassword(ext)}
                                        >
                                            <RotateCcwIcon />
                                            <span className="sr-only">
                                                Resetar senha
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onDelete(ext)}
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
