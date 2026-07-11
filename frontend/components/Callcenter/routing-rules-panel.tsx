"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { RoutingRuleFormDialog } from "@/components/Callcenter/routing-rule-form-dialog"
import { RoutingRulesTable } from "@/components/Callcenter/routing-rules-table"
import { useRoutingRules, type RoutingRule } from "@/hooks/use-routing-rules"
import { useTrunks } from "@/hooks/use-trunks"

type Props = {
    companyId: string
}

export function RoutingRulesPanel({ companyId }: Props) {
    const { routingRules, loading, createRoutingRule, updateRoutingRule, deleteRoutingRule } =
        useRoutingRules(companyId)
    const { trunks } = useTrunks(companyId)

    const [createOpen, setCreateOpen] = useState(false)
    const [editRule, setEditRule] = useState<RoutingRule | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<RoutingRule | null>(null)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteRoutingRule(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    Define QUEUE_PRIO antes do Queue() nativo com base em tronco, horário, dia da
                    semana ou padrão de callerId. A regra ativa de maior prioridade vence.
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova regra
                </Button>
            </div>

            <RoutingRulesTable
                routingRules={routingRules}
                trunks={trunks}
                loading={loading}
                onEdit={setEditRule}
                onDelete={setDeleteTarget}
            />

            {createOpen && (
                <RoutingRuleFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    routingRule={null}
                    companyId={companyId}
                    trunks={trunks}
                    onSave={createRoutingRule}
                />
            )}

            {editRule && (
                <RoutingRuleFormDialog
                    open={!!editRule}
                    onOpenChange={(open) => !open && setEditRule(null)}
                    routingRule={editRule}
                    companyId={companyId}
                    trunks={trunks}
                    onSave={(form) =>
                        updateRoutingRule(editRule.id, {
                            name: form.name,
                            priority: form.priority,
                            conditions: form.conditions,
                            active: form.active,
                        })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar regra"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
