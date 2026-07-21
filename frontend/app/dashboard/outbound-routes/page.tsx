"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { OutboundRouteFormDialog } from "@/components/OutboundRoutes/outbound-route-form-dialog"
import { OutboundRoutesTable } from "@/components/OutboundRoutes/outbound-routes-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useExtensions } from "@/hooks/use-extensions"
import {
    useOutboundRoutes,
    type OutboundRoute,
} from "@/hooks/use-outbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

export default function OutboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<OutboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<OutboundRoute | null>(null)

    // Empresa usada para escopar troncos/ramais/rotas existentes do formulário (o dialog não
    // deixa escolher empresa): a da rota em edição, ou o filtro da tabela
    const formCompanyId = editRoute?.companyId ?? companyFilter

    const { trunks: formTrunks } = useTrunks(formCompanyId)
    const { extensions: formExtensions } = useExtensions(formCompanyId)
    const {
        routes,
        allRoutes,
        loading,
        filter,
        setFilter,
        createRoute,
        updateRoute,
        deleteRoute,
    } = useOutboundRoutes(companyFilter)
    // allRoutes já vem escopado pelo companyId da própria requisição (fetch por companyFilter) —
    // conflito de padrão de discagem é validado dentro dessa mesma empresa
    const companyAllRoutes = allRoutes.filter(
        (r) => r.companyId === formCompanyId
    )

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
                title="Rotas de saída"
                description="Gerencie as rotas de discagem de saída das empresas"
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

            <OutboundRoutesTable
                routes={paginated}
                trunks={formTrunks}
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
                <OutboundRouteFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    route={null}
                    trunks={formTrunks}
                    extensions={formExtensions}
                    existingRoutes={companyAllRoutes}
                    onSave={(form) => createRoute(form, formCompanyId!)}
                />
            )}

            {editRoute && (
                <OutboundRouteFormDialog
                    open={!!editRoute}
                    onOpenChange={(open) => !open && setEditRoute(null)}
                    route={editRoute}
                    trunks={formTrunks}
                    extensions={formExtensions}
                    existingRoutes={companyAllRoutes}
                    onSave={(form) => updateRoute(editRoute.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar rota de saída"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
