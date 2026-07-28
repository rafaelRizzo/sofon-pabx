import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { FlowFormDialog } from "@/components/Flows/flow-form-dialog"
import { FlowsTable } from "@/components/Flows/flows-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useFlows, type Flow } from "@/hooks/use-flows"
import { usePagination } from "@/hooks/use-pagination"

function FlowsPage() {
    const navigate = useNavigate()
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        flows,
        loading,
        filter,
        setFilter,
        createFlow,
        updateFlow,
        deleteFlow,
    } = useFlows(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editFlow, setEditFlow] = useState<Flow | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        flows,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteFlow(deleteTarget.id)
    }

    // Cria e já leva pro canvas — o flow recém-criado só tem nome/empresa, conectar nós é o
    // próximo passo natural.
    async function handleCreate(form: Parameters<typeof createFlow>[0]) {
        const flowId = await createFlow(form)
        if (flowId) navigate({ to: "/dashboard/flows/$id", params: { id: flowId } })
        return !!flowId
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Flows"
                description="Monte cadeias de nós no canvas e reaproveite como um destino único em qualquer rota"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo flow
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

            <FlowsTable
                flows={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onOpen={(flow) =>
                    navigate({ to: "/dashboard/flows/$id", params: { id: flow.id } })
                }
                onEdit={setEditFlow}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <FlowFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    flow={null}
                    companies={companies}
                    onSave={handleCreate}
                />
            )}

            {editFlow && (
                <FlowFormDialog
                    open={!!editFlow}
                    onOpenChange={(open) => !open && setEditFlow(null)}
                    flow={editFlow}
                    companies={companies}
                    onSave={(form) =>
                        updateFlow(editFlow.id, { name: form.name })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar flow"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/flows/")({
    component: FlowsPage,
})
