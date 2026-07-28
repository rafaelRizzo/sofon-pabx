import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { VariableSetFormDialog } from "@/components/Variables/variable-set-form-dialog"
import { VariableSetsTable } from "@/components/Variables/variable-sets-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useVariables, type VariableSet } from "@/hooks/use-variables"

function VariablesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        variableSets,
        loading,
        filter,
        setFilter,
        createVariableSet,
        updateVariableSet,
        deleteVariableSet,
    } = useVariables(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariableSet, setEditVariableSet] = useState<VariableSet | null>(
        null
    )
    const [deleteTarget, setDeleteTarget] = useState<VariableSet | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        variableSets,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariableSet(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Variáveis"
                description="Seta variáveis de canal (Set) e segue pro destino configurado, encadeável em qualquer fluxo"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova variável
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

            <VariableSetsTable
                variableSets={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditVariableSet}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <VariableSetFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    variableSet={null}
                    companies={companies}
                    onSave={createVariableSet}
                />
            )}

            {editVariableSet && (
                <VariableSetFormDialog
                    open={!!editVariableSet}
                    onOpenChange={(open) => !open && setEditVariableSet(null)}
                    variableSet={editVariableSet}
                    companies={companies}
                    onSave={(form) =>
                        updateVariableSet(editVariableSet.id, form)
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar variável"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/variables")({
  component: VariablesPage,
})
