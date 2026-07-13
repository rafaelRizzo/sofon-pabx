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
import { WEEKDAY_LABELS } from "@/components/TimeGroups/weekday-checkboxes"
import { type Company } from "@/hooks/use-companies"
import { WEEKDAYS, type TimeGroup, type TimeRange, type Weekday } from "@/hooks/use-time-groups"

const MONTH_LABELS: Record<string, string> = {
    jan: "Jan",
    feb: "Fev",
    mar: "Mar",
    apr: "Abr",
    may: "Mai",
    jun: "Jun",
    jul: "Jul",
    aug: "Ago",
    sep: "Set",
    oct: "Out",
    nov: "Nov",
    dec: "Dez",
}

// Traduz "jan" / "jan-jun" pro rótulo em PT-BR
function formatMonths(months: string): string {
    return months
        .split("-")
        .map((m) => MONTH_LABELS[m] ?? m)
        .join("-")
}

// Agrupa dias consecutivos (ex: seg,ter,qua,qui,sex -> "Seg-Sex") pra exibição compacta
function formatWeekdays(weekdays: Weekday[]): string {
    const sorted = WEEKDAYS.filter((d) => weekdays.includes(d))
    if (sorted.length === 0) return ""
    if (sorted.length === 7) return "Todos os dias"

    const groups: Weekday[][] = []
    for (const day of sorted) {
        const last = groups[groups.length - 1]
        const lastIndex = last ? WEEKDAYS.indexOf(last[last.length - 1]) : -1
        if (last && WEEKDAYS.indexOf(day) === lastIndex + 1) {
            last.push(day)
        } else {
            groups.push([day])
        }
    }

    return groups
        .map((g) =>
            g.length > 1
                ? `${WEEKDAY_LABELS[g[0]]}-${WEEKDAY_LABELS[g[g.length - 1]]}`
                : WEEKDAY_LABELS[g[0]]
        )
        .join(", ")
}

function formatRange(range: TimeRange): string {
    const parts = [
        `${formatWeekdays(range.weekdays)} ${range.startTime}–${range.endTime}`,
    ]
    if (range.monthdays !== "*") parts.push(`dia ${range.monthdays}`)
    if (range.months !== "*") parts.push(formatMonths(range.months))
    return parts.join(" · ")
}

type Props = {
    timeGroups: TimeGroup[]
    companies: Company[]
    loading: boolean
    companySelected: boolean
    onEdit: (timeGroup: TimeGroup) => void
    onDelete: (timeGroup: TimeGroup) => void
}

export function TimeGroupsTable({
    timeGroups,
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
                        <TableHead>Períodos</TableHead>
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
                    ) : timeGroups.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected ? "Nenhum grupo de horário encontrado" : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        timeGroups.map((group) => (
                            <TableRow key={group.id}>
                                <TableCell className="font-medium">
                                    {group.name}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {companyName(group.companyId)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {group.ranges.map((range) => (
                                            <Badge
                                                key={range.id}
                                                variant="outline"
                                                className="w-fit border-transparent bg-blue-500/15 font-normal text-blue-600 dark:bg-blue-400/20 dark:text-blue-300"
                                            >
                                                {formatRange(range)}
                                            </Badge>
                                        ))}
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
                                                                onEdit(group)
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
                                                    Editar grupo de horário
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(group)
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
                                                    Deletar grupo de horário
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
