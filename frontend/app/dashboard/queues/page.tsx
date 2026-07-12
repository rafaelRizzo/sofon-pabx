"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { QueueFormDialog } from "@/components/Queues/queue-form-dialog"
import { QueueMembersSheet } from "@/components/Queues/queue-members-sheet"
import { QueuesTable } from "@/components/Queues/queues-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useQueues, type Queue } from "@/hooks/use-queues"

export default function QueuesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const { queues, loading, filter, setFilter, createQueue, updateQueue, deleteQueue } =
        useQueues(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editQueue, setEditQueue] = useState<Queue | null>(null)
    const [membersQueue, setMembersQueue] = useState<Queue | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(queues, 15)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteQueue(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Filas"
                description="Distribua chamadas entre ramais com estratégias de atendimento"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova fila
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome ou número..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm"
                />
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
            </div>

            <QueuesTable
                queues={paginated}
                companies={companies}
                loading={loading}
                onEdit={setEditQueue}
                onManageMembers={setMembersQueue}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && (
                <QueueFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    queue={null}
                    companies={companies}
                    onSave={createQueue}
                />
            )}

            {editQueue && (
                <QueueFormDialog
                    open={!!editQueue}
                    onOpenChange={(open) => !open && setEditQueue(null)}
                    queue={editQueue}
                    companies={companies}
                    onSave={(form) =>
                        updateQueue(editQueue.id, {
                            name: form.name,
                            number: form.number,
                            strategy: form.strategy,
                            musicOnHold: form.musicOnHold,
                            timeout: form.timeout,
                            retry: form.retry,
                            maxLen: form.maxLen,
                            wrapupTime: form.wrapupTime,
                            announce: form.announce,
                            announceFrequency: form.announceFrequency,
                            announcePosition: form.announcePosition,
                            periodicAnnounce: form.periodicAnnounce,
                            periodicAnnounceFrequency: form.periodicAnnounceFrequency,
                            agentAnnounce: form.agentAnnounce,
                            joinEmpty: form.joinEmpty,
                            leaveWhenEmpty: form.leaveWhenEmpty,
                            weight: form.weight,
                            postQueueDestination: form.postQueueDestination,
                            surveyAudioId: form.surveyAudioId,
                            callcenterEnabled: form.callcenterEnabled,
                        })
                    }
                />
            )}

            <QueueMembersSheet
                open={!!membersQueue}
                onOpenChange={(open) => !open && setMembersQueue(null)}
                queue={membersQueue}
            />

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar fila"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
