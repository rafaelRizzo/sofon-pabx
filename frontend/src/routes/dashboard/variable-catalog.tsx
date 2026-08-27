import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { VariableCatalogFormDialog } from "@/components/VariableCatalog/variable-catalog-form-dialog"
import { VariableCatalogTable } from "@/components/VariableCatalog/variable-catalog-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useVariableCatalog, type Variable } from "@/hooks/use-variable-catalog"

function VariableCatalogPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        variables,
        loading,
        filter,
        setFilter,
        createVariable,
        updateVariable,
        deleteVariable,
    } = useVariableCatalog(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariable, setEditVariable] = useState<Variable | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Variable | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        variables,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariable(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Catálogo de Variáveis"
                description="Nomes de variável declarados pela empresa, usados por URAs e Definir Variável"
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

            <VariableCatalogTable
                variables={paginated}
                companies={companies}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditVariable}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <VariableCatalogFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    variable={null}
                    companies={companies}
                    defaultCompanyId={companyFilter}
                    onSave={createVariable}
                />
            )}

            {editVariable && (
                <VariableCatalogFormDialog
                    open={!!editVariable}
                    onOpenChange={(open) => !open && setEditVariable(null)}
                    variable={editVariable}
                    companies={companies}
                    onSave={(form) =>
                        updateVariable(editVariable.id, {
                            name: form.name,
                            description: form.description,
                        })
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

export const Route = createFileRoute("/dashboard/variable-catalog")({
    component: VariableCatalogPage,
})
