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
import { UsedByBadge } from "@/components/RouteDestination/used-by-badge"
import {
    type HttpMethod,
    type RequestTemplate,
} from "@/hooks/use-request-templates"

const METHOD_BADGE_CLASS: Record<HttpMethod, string> = {
    GET: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    POST: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    PUT: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    PATCH: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    DELETE: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
}

type Props = {
    requestTemplates: RequestTemplate[]
    loading: boolean
    companySelected: boolean
    onEdit: (requestTemplate: RequestTemplate) => void
    onDelete: (requestTemplate: RequestTemplate) => void
}

export function RequestTemplatesTable({
    requestTemplates,
    loading,
    companySelected,
    onEdit,
    onDelete,
}: Props) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Requisição</TableHead>
                        <TableHead>Variáveis</TableHead>
                        <TableHead>Sucesso</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Usado por</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 7 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : requestTemplates.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum template de requisição encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        requestTemplates.map((rt) => (
                            <TableRow key={rt.id}>
                                <TableCell className="font-medium">
                                    {rt.name}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className={
                                                METHOD_BADGE_CLASS[rt.method]
                                            }
                                        >
                                            {rt.method}
                                        </Badge>
                                        <span className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                                            {rt.url}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {rt.variableMappings.length > 0 ? (
                                        <Badge variant="secondary">
                                            {rt.variableMappings.length}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={rt.onSuccess}
                                        tone="true"
                                    />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={rt.onError}
                                        tone="false"
                                    />
                                </TableCell>
                                <TableCell>
                                    <UsedByBadge usedBy={rt.usedBy} />
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
                                                                onEdit(rt)
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
                                                    Editar template
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(rt)
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
                                                    Deletar template
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
