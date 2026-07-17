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
import { type IvrMenu } from "@/hooks/use-ivr"

type Props = {
    ivrMenus: IvrMenu[]
    loading: boolean
    companySelected: boolean
    onEdit: (ivrMenu: IvrMenu) => void
    onDelete: (ivrMenu: IvrMenu) => void
}

export function IvrMenusTable({ ivrMenus, loading, companySelected, onEdit, onDelete }: Props) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Áudio</TableHead>
                        <TableHead>Opções</TableHead>
                        <TableHead>Dígito inválido</TableHead>
                        <TableHead>Timeout</TableHead>
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
                    ) : ivrMenus.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                {companySelected ? "Nenhum menu de URA encontrado" : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        ivrMenus.map((menu) => (
                            <TableRow key={menu.id}>
                                <TableCell className="font-medium">{menu.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {menu.type === "collect" ? "Coleta" : "Menu"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={
                                            menu.hasAudio
                                                ? "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300"
                                                : "border-transparent bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-300"
                                        }
                                    >
                                        {menu.hasAudio ? "Vinculado" : "Sem áudio"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {menu.type === "collect" ? (
                                        <span className="text-xs">
                                            {menu.maxDigits} dígitos <span className="text-muted-foreground">→</span>{" "}
                                            <code className="text-xs">{menu.variableName}</code>
                                        </span>
                                    ) : (
                                        <TooltipProvider delay={150}>
                                            <div className="flex flex-wrap gap-1">
                                                {menu.options.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">Nenhuma</span>
                                                )}
                                                {menu.options.map((opt) => {
                                                    const type = opt.destination?.type ?? "hangup"
                                                    const label =
                                                        opt.destination && "label" in opt.destination
                                                            ? opt.destination.label
                                                            : null
                                                    return (
                                                        <Tooltip key={opt.id}>
                                                            <TooltipTrigger
                                                                render={
                                                                    <Badge variant="secondary" className="cursor-default">
                                                                        {opt.digit}
                                                                    </Badge>
                                                                }
                                                            />
                                                            <TooltipContent>
                                                                {label ?? (type === "hangup" ? "Encerrar chamada" : "registro não encontrado")}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )
                                                })}
                                            </div>
                                        </TooltipProvider>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge destination={menu.invalidDestination} />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge destination={menu.timeoutDestination} />
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
                                                            onClick={() => onEdit(menu)}
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">Editar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Editar menu</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => onDelete(menu)}
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">Deletar</span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>Deletar menu</TooltipContent>
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
