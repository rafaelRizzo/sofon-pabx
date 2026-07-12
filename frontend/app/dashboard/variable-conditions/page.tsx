"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { VariableConditionFormDialog } from "@/components/VariableConditions/variable-condition-form-dialog"
import { VariableConditionsTable } from "@/components/VariableConditions/variable-conditions-table"
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
import { useVariableConditions, type VariableCondition } from "@/hooks/use-variable-conditions"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function VariableConditionsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const {
        variableConditions,
        loading,
        filter,
        setFilter,
        createVariableCondition,
        updateVariableCondition,
        deleteVariableCondition,
    } = useVariableConditions(companyFilter === "all" ? undefined : companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariableCondition, setEditVariableCondition] = useState<VariableCondition | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<VariableCondition | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(variableConditions, 15)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariableCondition(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Condições de variável"
                description="Valida variáveis de canal (preenchida, tamanho, igualdade, regex, numérica) e direciona por trueRoute/falseRoute"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova condição
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

            <VariableConditionsTable
                variableConditions={paginated}
                loading={loading}
                onEdit={setEditVariableCondition}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && (
                <VariableConditionFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    variableCondition={null}
                    companies={companies}
                    onSave={createVariableCondition}
                />
            )}

            {editVariableCondition && (
                <VariableConditionFormDialog
                    open={!!editVariableCondition}
                    onOpenChange={(open) => !open && setEditVariableCondition(null)}
                    variableCondition={editVariableCondition}
                    companies={companies}
                    onSave={(form) => updateVariableCondition(editVariableCondition.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar condição de variável"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
