"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { PauseReasonFormDialog } from "@/components/Callcenter/pause-reason-form-dialog"
import { PauseReasonsTable } from "@/components/Callcenter/pause-reasons-table"
import { usePauseReasons, type PauseReason } from "@/hooks/use-pause-reasons"
import { type PauseReasonsPanelProps } from "@/components/Callcenter/types"

export function PauseReasonsPanel({ companyId }: PauseReasonsPanelProps) {
    const {
        pauseReasons,
        loading,
        createPauseReason,
        updatePauseReason,
        deletePauseReason,
    } = usePauseReasons(companyId)

    const [createOpen, setCreateOpen] = useState(false)
    const [editReason, setEditReason] = useState<PauseReason | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<PauseReason | null>(null)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deletePauseReason(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    Catálogo de motivos que o agente escolhe ao se pausar no
                    Painel do Agente (/dashboard/atendimento)
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo motivo
                </Button>
            </div>

            <PauseReasonsTable
                pauseReasons={pauseReasons}
                loading={loading}
                onEdit={setEditReason}
                onDelete={setDeleteTarget}
            />

            {createOpen && (
                <PauseReasonFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    pauseReason={null}
                    companyId={companyId}
                    onSave={createPauseReason}
                />
            )}

            {editReason && (
                <PauseReasonFormDialog
                    open={!!editReason}
                    onOpenChange={(open) => !open && setEditReason(null)}
                    pauseReason={editReason}
                    companyId={companyId}
                    onSave={(form) =>
                        updatePauseReason(editReason.id, {
                            label: form.label,
                            active: form.active,
                        })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar motivo de pausa"
                itemName={deleteTarget?.label}
                onConfirm={handleDelete}
            />
        </div>
    )
}
