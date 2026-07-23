import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { InboundRouteFormDialog } from "@/components/InboundRoutes/inbound-route-form-dialog"
import { InboundRoutesTable } from "@/components/InboundRoutes/inbound-routes-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useDids } from "@/hooks/use-dids"
import { useInboundRoutes, type InboundRoute } from "@/hooks/use-inbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

function InboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<InboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<InboundRoute | null>(null)

    // Empresa usada para escopar DIDs/troncos do formulário (o dialog não deixa escolher
    // empresa): a da rota em edição, ou o filtro da tabela
    const formCompanyId = editRoute?.companyId ?? companyFilter

    const { dids: formDids } = useDids(formCompanyId)
    const { trunks: formTrunks } = useTrunks(formCompanyId)
    const {
        routes,
        allRoutes,
        loading,
        filter,
        setFilter,
        createRoute,
        updateRoute,
        deleteRoute,
    } = useInboundRoutes(companyFilter)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        routes,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteRoute(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Rotas de entrada"
                description="Gerencie para onde as chamadas recebidas em cada DID são direcionadas"
            >
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={!companyFilter}
                >
                    <PlusIcon />
                    Nova rota
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome, DID ou tronco..."
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

            <InboundRoutesTable
                routes={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditRoute}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && companyFilter && (
                <InboundRouteFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    route={null}
                    companyId={formCompanyId!}
                    dids={formDids}
                    trunks={formTrunks}
                    existingRoutes={allRoutes}
                    onSave={(form) => createRoute(form, formCompanyId!)}
                />
            )}

            {editRoute && (
                <InboundRouteFormDialog
                    open={!!editRoute}
                    onOpenChange={(open) => !open && setEditRoute(null)}
                    route={editRoute}
                    companyId={formCompanyId!}
                    dids={formDids}
                    trunks={formTrunks}
                    existingRoutes={allRoutes}
                    onSave={(form) =>
                        updateRoute(editRoute.id, {
                            name: form.name,
                            destination: form.destination,
                        })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar rota de entrada"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/inbound-routes")({
  component: InboundRoutesPage,
})
