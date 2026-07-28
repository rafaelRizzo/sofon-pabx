import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { IvrMenuFormDialog } from "@/components/Ivr/ivr-menu-form-dialog"
import { IvrMenusTable } from "@/components/Ivr/ivr-menus-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useIvr, type IvrMenu } from "@/hooks/use-ivr"
import { usePagination } from "@/hooks/use-pagination"

function IvrPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        ivrMenus,
        loading,
        filter,
        setFilter,
        createIvrMenu,
        updateIvrMenu,
        deleteIvrMenu,
    } = useIvr(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editIvrMenu, setEditIvrMenu] = useState<IvrMenu | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<IvrMenu | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        ivrMenus,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteIvrMenu(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="URA"
                description="Gerencie os menus de atendimento automático (URA) e para onde cada tecla direciona a chamada"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo menu
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

            <IvrMenusTable
                ivrMenus={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditIvrMenu}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <IvrMenuFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    ivrMenu={null}
                    companies={companies}
                    onSave={async (form) =>
                        Boolean(await createIvrMenu(form, form.companyId))
                    }
                />
            )}

            {editIvrMenu && (
                <IvrMenuFormDialog
                    open={!!editIvrMenu}
                    onOpenChange={(open) => !open && setEditIvrMenu(null)}
                    ivrMenu={editIvrMenu}
                    companies={companies}
                    onSave={(form) => updateIvrMenu(editIvrMenu.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar menu de URA"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/ivr")({
    component: IvrPage,
})
