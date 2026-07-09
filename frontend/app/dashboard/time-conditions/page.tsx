"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { TimeConditionFormDialog } from "@/components/TimeConditions/time-condition-form-dialog"
import { TimeConditionsTable } from "@/components/TimeConditions/time-conditions-table"
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
import { useTimeConditions, type TimeCondition } from "@/hooks/use-time-conditions"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function TimeConditionsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const {
        timeConditions,
        loading,
        filter,
        setFilter,
        createTimeCondition,
        updateTimeCondition,
        deleteTimeCondition,
    } = useTimeConditions(companyFilter === "all" ? undefined : companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editTimeCondition, setEditTimeCondition] = useState<TimeCondition | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<TimeCondition | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(timeConditions, 15)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteTimeCondition(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Condições de horário"
                description="Direcione chamadas de acordo com os grupos de horário vinculados"
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

            <TimeConditionsTable
                timeConditions={paginated}
                loading={loading}
                onEdit={setEditTimeCondition}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && (
                <TimeConditionFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    timeCondition={null}
                    companies={companies}
                    onSave={createTimeCondition}
                />
            )}

            {editTimeCondition && (
                <TimeConditionFormDialog
                    open={!!editTimeCondition}
                    onOpenChange={(open) => !open && setEditTimeCondition(null)}
                    timeCondition={editTimeCondition}
                    companies={companies}
                    onSave={(form) =>
                        updateTimeCondition(editTimeCondition.id, {
                            name: form.name,
                            trueRoute: form.trueRoute,
                            falseRoute: form.falseRoute,
                        })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar condição de horário"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
