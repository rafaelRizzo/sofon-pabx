"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { TimeGroupFormDialog } from "@/components/TimeGroups/time-group-form-dialog"
import { TimeGroupsTable } from "@/components/TimeGroups/time-groups-table"
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
import { useCompanies, type Company } from "@/hooks/use-companies"
import { usePagination } from "@/hooks/use-pagination"
import { useTimeGroups, type TimeGroup } from "@/hooks/use-time-groups"

export default function TimeGroupsPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useState<string>("")

    useEffect(() => {
        if (!companyId && companies.length > 0) {
            setCompanyId(companies[0].id)
        }
    }, [companies, companyId])

    const {
        timeGroups,
        loading,
        filter,
        setFilter,
        createTimeGroup,
        updateTimeGroup,
        deleteTimeGroup,
    } = useTimeGroups(companyId)

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
                <Combobox<Company>
                    items={companies}
                    value={companies.find((c) => c.id === companyId) ?? null}
                    itemToStringLabel={(c) => c.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(company) => setCompanyId(company?.id ?? "")}
                >
                    <ComboboxInput placeholder="Buscar empresa..." className="w-56" />
                    <ComboboxContent>
                        <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                        <ComboboxList>
                            {(company: Company) => (
                                <ComboboxItem key={company.id} value={company}>
                                    {company.name}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
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
