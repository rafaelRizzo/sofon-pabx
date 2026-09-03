import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { TrunkFormDialog } from "@/components/Trunks/trunk-form-dialog"
import { TrunksTable } from "@/components/Trunks/trunks-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useRealtimeTrunks } from "@/hooks/use-realtime"
import { useTrunks, type Trunk } from "@/hooks/use-trunks"

function TrunksPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        trunks,
        loading,
        filter,
        setFilter,
        createTrunk,
        updateTrunk,
        toggleTrunkActive,
        deleteTrunk,
    } = useTrunks(companyFilter)

    const { trunks: realtimeTrunks } = useRealtimeTrunks(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editTrunk, setEditTrunk] = useState<Trunk | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Trunk | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        trunks,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteTrunk(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Troncos"
                description="Gerencie os troncos SIP de entrada e saída"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo tronco
                </Button>
            </PageHeader>

            <FilterBar>
                <Input
                    placeholder="Buscar por nome, host..."
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

            <TrunksTable
                trunks={paginated}
                realtimeTrunks={realtimeTrunks}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditTrunk}
                onDelete={setDeleteTarget}
                onToggleActive={(trunk, active) =>
                    toggleTrunkActive(trunk.id, active)
                }
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <TrunkFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    trunk={null}
                    companies={companies}
                    onCreate={createTrunk}
                />
            )}

            {editTrunk && (
                <TrunkFormDialog
                    open={!!editTrunk}
                    onOpenChange={(open) => !open && setEditTrunk(null)}
                    trunk={editTrunk}
                    companies={companies}
                    onUpdate={(form) => updateTrunk(editTrunk.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar tronco"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/trunks")({
  component: TrunksPage,
})
