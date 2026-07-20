"use client"

import { InfinityIcon, PencilIcon, Trash2Icon } from "lucide-react"

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
import { type Trunk } from "@/hooks/use-trunks"

type Props = {
    trunks: Trunk[]
    loading: boolean
    companySelected: boolean
    onEdit: (trunk: Trunk) => void
    onDelete: (trunk: Trunk) => void
}

export function TrunksTable({
    trunks,
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
                        <TableHead>Tipo</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Codecs</TableHead>
                        <TableHead className="text-center">
                            Canais (in/out)
                        </TableHead>
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
                    ) : trunks.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum tronco encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        trunks.map((trunk) => (
                            <TableRow key={trunk.id}>
                                <TableCell className="font-medium">
                                    {trunk.name}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            (trunk.type ?? "pjsip") === "pjsip"
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {(trunk.type ?? "pjsip").toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            trunk.registrationMode === "outbound"
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {trunk.registrationMode === "outbound"
                                            ? "Outbound"
                                            : `Inbound (${trunk.identifyBy === "username" ? "usuário" : "IP"})`}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                    {trunk.host
                                        ? `${trunk.host}${trunk.port ? `:${trunk.port}` : ""}`
                                        : "-"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {trunk.codecs}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    <div className="flex items-center justify-center gap-1">
                                        {trunk.maxInChannels ?? (
                                            <InfinityIcon className="size-3.5" />
                                        )}
                                        <span>/</span>
                                        {trunk.maxOutChannels ?? (
                                            <InfinityIcon className="size-3.5" />
                                        )}
                                    </div>
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
                                                                onEdit(trunk)
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
                                                    Editar tronco
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(trunk)
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
                                                    Deletar tronco
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
