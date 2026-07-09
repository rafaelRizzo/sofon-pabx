"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { OutboundRouteFormDialog } from "@/components/OutboundRoutes/outbound-route-form-dialog"
import { OutboundRoutesTable } from "@/components/OutboundRoutes/outbound-routes-table"
import { PageHeader } from "@/components/page-header"
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
import { useExtensions } from "@/hooks/use-extensions"
import { useOutboundRoutes, type OutboundRoute } from "@/hooks/use-outbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function OutboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<OutboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<OutboundRoute | null>(null)

    // Empresa usada para escopar troncos/ramais/rotas existentes do formulário (o dialog não
    // deixa escolher empresa): a da rota em edição, ou o filtro quando uma empresa específica
    // está selecionada — "Todas as empresas" não é uma empresa válida pra criar/editar
    const formCompanyId = editRoute?.companyId ?? (companyFilter !== "all" ? companyFilter : undefined)

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
    } = useOutboundRoutes(companyFilter === "all" ? undefined : companyFilter)
    // allRoutes já vem escopado pelo companyId da própria requisição (fetch por companyFilter) —
    // conflito de padrão de discagem é validado dentro dessa mesma empresa
    const companyAllRoutes = allRoutes.filter((r) => r.companyId === formCompanyId)

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
                    disabled={companyFilter === "all"}
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

            <OutboundRoutesTable
                routes={paginated}
                trunks={formTrunks}
                loading={loading}
                onEdit={setEditRoute}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && companyFilter !== "all" && (
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
