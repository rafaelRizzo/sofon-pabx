"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { QueueFormDialog } from "@/components/Queues/queue-form-dialog"
import { QueueMembersSheet } from "@/components/Queues/queue-members-sheet"
import { QueuesTable } from "@/components/Queues/queues-table"
import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { usePagination } from "@/hooks/use-pagination"
import { useQueues, type Queue } from "@/hooks/use-queues"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function QueuesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const { queues, loading, filter, setFilter, createQueue, updateQueue, deleteQueue } =
        useQueues(companyFilter === "all" ? undefined : companyFilter)

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
                <Combobox<CompanyFilterOption>
                    items={[ALL_COMPANIES, ...companies]}
                    value={
                        [ALL_COMPANIES, ...companies].find(
                            (c) => c.id === companyFilter
                        ) ?? ALL_COMPANIES
                    }
                    itemToStringLabel={(c) => c.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(company) =>
                        setCompanyFilter(company?.id ?? "all")
                    }
                >
                    <ComboboxInput placeholder="Buscar empresa..." className="w-56" />
                    <ComboboxContent>
                        <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                        <ComboboxList>
                            {(company: CompanyFilterOption) => (
                                <ComboboxItem key={company.id} value={company}>
                                    {company.name}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
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
