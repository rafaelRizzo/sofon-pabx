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
import { WEEKDAY_LABELS } from "@/components/TimeGroups/weekday-checkboxes"
import { type RoutingRule } from "@/hooks/use-routing-rules"
import { type Trunk } from "@/hooks/use-trunks"

type Props = {
    routingRules: RoutingRule[]
    trunks: Trunk[]
    loading: boolean
    onEdit: (routingRule: RoutingRule) => void
    onDelete: (routingRule: RoutingRule) => void
}

function conditionsSummary(
    rule: RoutingRule,
    trunkNameById: Map<string, string>
): string {
    const parts: string[] = []
    if (rule.conditions.trunkId) {
        parts.push(
            `tronco ${trunkNameById.get(rule.conditions.trunkId) ?? rule.conditions.trunkId}`
        )
    }
    if (rule.conditions.weekdays?.length) {
        parts.push(
            rule.conditions.weekdays.map((d) => WEEKDAY_LABELS[d]).join("/")
        )
    }
    if (rule.conditions.startTime && rule.conditions.endTime) {
        parts.push(`${rule.conditions.startTime}-${rule.conditions.endTime}`)
    }
    if (rule.conditions.callerIdPattern)
        parts.push(`callerId~${rule.conditions.callerIdPattern}`)
    return parts.length > 0 ? parts.join(" · ") : "Sem condições"
}

export function RoutingRulesTable({
    routingRules,
    trunks,
    loading,
    onEdit,
    onDelete,
}: Props) {
    const trunkNameById = new Map(trunks.map((t) => [t.id, t.name]))
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Condições</TableHead>
                        <TableHead>Prioridade</TableHead>
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
                    ) : routingRules.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                            >
                                Nenhuma regra cadastrada
                            </TableCell>
                        </TableRow>
                    ) : (
                        routingRules.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-medium">
                                    {rule.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {conditionsSummary(rule, trunkNameById)}
                                </TableCell>
                                <TableCell>{rule.priority}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            rule.active ? "default" : "outline"
                                        }
                                    >
                                        {rule.active ? "Ativa" : "Inativa"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => onEdit(rule)}
                                        >
                                            <PencilIcon />
                                            <span className="sr-only">
                                                Editar
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onDelete(rule)}
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
