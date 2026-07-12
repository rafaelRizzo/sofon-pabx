"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { VariableSetFormDialog } from "@/components/Variables/variable-set-form-dialog"
import { VariableSetsTable } from "@/components/Variables/variable-sets-table"
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
import { useVariables, type VariableSet } from "@/hooks/use-variables"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function VariablesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const {
        variableSets,
        loading,
        filter,
        setFilter,
        createVariableSet,
        updateVariableSet,
        deleteVariableSet,
    } = useVariables(companyFilter === "all" ? undefined : companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariableSet, setEditVariableSet] = useState<VariableSet | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<VariableSet | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(variableSets, 15)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariableSet(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Variáveis"
                description="Seta variáveis de canal (Set) e segue pro destino configurado — encadeável em qualquer fluxo"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova variável
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome..."
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

            <VariableSetsTable
                variableSets={paginated}
                loading={loading}
                onEdit={setEditVariableSet}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

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
                    onSave={(form) => updateVariableSet(editVariableSet.id, form)}
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
