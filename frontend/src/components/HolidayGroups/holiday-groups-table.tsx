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
import { type HolidayGroup } from "@/hooks/use-holiday-groups"

type Props = {
    holidayGroups: HolidayGroup[]
    loading: boolean
    companySelected: boolean
    onEdit: (holidayGroup: HolidayGroup) => void
    onDelete: (holidayGroup: HolidayGroup) => void
}

export function HolidayGroupsTable({
    holidayGroups,
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
                        <TableHead>Origem</TableHead>
                        <TableHead>Datas</TableHead>
                        <TableHead>Em feriado</TableHead>
                        <TableHead>Fora de feriado</TableHead>
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
                    ) : holidayGroups.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum grupo de feriados encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        holidayGroups.map((hg) => (
                            <TableRow key={hg.id}>
                                <TableCell className="font-medium">
                                    {hg.name}
                                </TableCell>
                                <TableCell>
                                    {hg.url ? (
                                        <Badge
                                            variant="outline"
                                            className="gap-1.5 border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300"
                                        >
                                            Automático
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="text-muted-foreground"
                                        >
                                            Manual
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {hg.dates.length === 0 ? (
                                        <span className="text-muted-foreground">
                                            —
                                        </span>
                                    ) : (
                                        <TooltipProvider delay={100}>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Badge variant="outline">
                                                            {hg.dates.length}{" "}
                                                            {hg.dates.length ===
                                                            1
                                                                ? "data"
                                                                : "datas"}
                                                        </Badge>
                                                    }
                                                />
                                                <TooltipContent>
                                                    <ul className="flex flex-col gap-0.5">
                                                        {hg.dates.map((d) => (
                                                            <li key={d.id}>
                                                                {d.name} (
                                                                {String(
                                                                    d.day
                                                                ).padStart(
                                                                    2,
                                                                    "0"
                                                                )}
                                                                /
                                                                {String(
                                                                    d.month
                                                                ).padStart(
                                                                    2,
                                                                    "0"
                                                                )}
                                                                )
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={hg.trueRoute}
                                        tone="true"
                                    />
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={hg.falseRoute}
                                        tone="false"
                                    />
                                </TableCell>
                                <TableCell>
                                    <UsedByBadge usedBy={hg.usedBy} />
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
                                                                onEdit(hg)
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
                                                    Editar grupo
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(hg)
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
                                                    Deletar grupo
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
