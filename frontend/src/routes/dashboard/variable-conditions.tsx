import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { VariableConditionFormDialog } from "@/components/VariableConditions/variable-condition-form-dialog"
import { VariableConditionsTable } from "@/components/VariableConditions/variable-conditions-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import {
    useVariableConditions,
    type VariableCondition,
} from "@/hooks/use-variable-conditions"

function VariableConditionsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        variableConditions,
        loading,
        filter,
        setFilter,
        createVariableCondition,
        updateVariableCondition,
        deleteVariableCondition,
    } = useVariableConditions(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariableCondition, setEditVariableCondition] =
        useState<VariableCondition | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<VariableCondition | null>(
        null
    )

    const { paginated, page, setPage, totalPages, total } = usePagination(
        variableConditions,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariableCondition(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Condições de variável"
                description="Valida variáveis de canal (preenchida, tamanho, igualdade, regex, numérica) — o destino verdadeiro/falso se conecta pelo canvas do Flow"
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
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
            </div>

            <VariableConditionsTable
                variableConditions={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditVariableCondition}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

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
                    onOpenChange={(open) =>
                        !open && setEditVariableCondition(null)
                    }
                    variableCondition={editVariableCondition}
                    companies={companies}
                    onSave={(form) =>
                        updateVariableCondition(editVariableCondition.id, form)
                    }
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

export const Route = createFileRoute("/dashboard/variable-conditions")({
  component: VariableConditionsPage,
})
