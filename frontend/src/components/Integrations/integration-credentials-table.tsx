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
import { INTEGRATION_PROVIDER_LABELS, type IntegrationCredential } from "@/hooks/use-integration-credentials"

type Props = {
    integrationCredentials: IntegrationCredential[]
    loading: boolean
    companySelected: boolean
    onEdit: (integrationCredential: IntegrationCredential) => void
    onDelete: (integrationCredential: IntegrationCredential) => void
}

export function IntegrationCredentialsTable({ integrationCredentials, loading, companySelected, onEdit, onDelete }: Props) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Provedor</TableHead>
                        <TableHead>Base URL</TableHead>
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
                    ) : integrationCredentials.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                {companySelected ? "Nenhuma credencial encontrada" : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        integrationCredentials.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell className="text-muted-foreground">{c.company.name}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{INTEGRATION_PROVIDER_LABELS[c.provider]}</Badge>
                                </TableCell>
                                <TableCell>
                                    <span className="max-w-64 truncate font-mono text-xs text-muted-foreground">{c.baseUrl}</span>
                                </TableCell>
                                <TableCell>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button variant="outline" size="icon" onClick={() => onEdit(c)}>
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar credencial</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button variant="destructive" size="icon" onClick={() => onDelete(c)}>
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar credencial</TooltipContent>
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
