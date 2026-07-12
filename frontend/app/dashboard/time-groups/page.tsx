"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { TimeGroupFormDialog } from "@/components/TimeGroups/time-group-form-dialog"
import { TimeGroupsTable } from "@/components/TimeGroups/time-groups-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useTimeGroups, type TimeGroup } from "@/hooks/use-time-groups"

export default function TimeGroupsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        timeGroups,
        loading,
        filter,
        setFilter,
        createTimeGroup,
        updateTimeGroup,
        deleteTimeGroup,
    } = useTimeGroups(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editTimeGroup, setEditTimeGroup] = useState<TimeGroup | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<TimeGroup | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        timeGroups,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteTimeGroup(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Grupos de horário"
                description="Gerencie os períodos usados nas condições de horário"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo grupo
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome..."
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

            <TimeGroupsTable
                timeGroups={paginated}
                companies={companies}
                loading={loading}
                onEdit={setEditTimeGroup}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <TimeGroupFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    timeGroup={null}
                    companies={companies}
                    onSave={createTimeGroup}
                />
            )}

            {editTimeGroup && (
                <TimeGroupFormDialog
                    open={!!editTimeGroup}
                    onOpenChange={(open) => !open && setEditTimeGroup(null)}
                    timeGroup={editTimeGroup}
                    companies={companies}
                    onSave={(form) =>
                        updateTimeGroup(editTimeGroup.id, { name: form.name, ranges: form.ranges })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar grupo de horário"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
