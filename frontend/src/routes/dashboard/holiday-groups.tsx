import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { HolidayGroupFormDialog } from "@/components/HolidayGroups/holiday-group-form-dialog"
import { HolidayGroupsTable } from "@/components/HolidayGroups/holiday-groups-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useHolidayGroups, type HolidayGroup } from "@/hooks/use-holiday-groups"
import { usePagination } from "@/hooks/use-pagination"

function HolidayGroupsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        holidayGroups,
        loading,
        filter,
        setFilter,
        createHolidayGroup,
        updateHolidayGroup,
        deleteHolidayGroup,
    } = useHolidayGroups(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editHolidayGroup, setEditHolidayGroup] =
        useState<HolidayGroup | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<HolidayGroup | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        holidayGroups,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteHolidayGroup(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Grupos de feriados"
                description="Direcione chamadas de acordo com datas de feriado, manuais ou auto-atualizadas por URL"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo grupo
                </Button>
            </PageHeader>

            <FilterBar>
                <Input
                    placeholder="Buscar por nome..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full md:max-w-sm"
                />
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
            </FilterBar>

            <HolidayGroupsTable
                holidayGroups={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditHolidayGroup}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <HolidayGroupFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    holidayGroup={null}
                    companies={companies}
                    onSave={createHolidayGroup}
                />
            )}

            {editHolidayGroup && (
                <HolidayGroupFormDialog
                    open={!!editHolidayGroup}
                    onOpenChange={(open) => !open && setEditHolidayGroup(null)}
                    holidayGroup={editHolidayGroup}
                    companies={companies}
                    onSave={(form) =>
                        updateHolidayGroup(editHolidayGroup.id, form)
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar grupo de feriados"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/holiday-groups")({
  component: HolidayGroupsPage,
})
