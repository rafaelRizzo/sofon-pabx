"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { InboundRouteFormDialog } from "@/components/InboundRoutes/inbound-route-form-dialog"
import { InboundRoutesTable } from "@/components/InboundRoutes/inbound-routes-table"
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
import { useDids } from "@/hooks/use-dids"
import { useInboundRoutes, type InboundRoute } from "@/hooks/use-inbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function InboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<InboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<InboundRoute | null>(null)

    // Empresa usada para escopar DIDs/troncos do formulário (o dialog não deixa escolher
    // empresa): a da rota em edição, ou o filtro quando uma empresa específica está
    // selecionada — "Todas as empresas" não é uma empresa válida pra criar/editar
    const formCompanyId = editRoute?.companyId ?? (companyFilter !== "all" ? companyFilter : undefined)

    const { dids } = useDids()
    const formDids = dids.filter((d) => d.companyId === formCompanyId)
    const { trunks } = useTrunks()
    const formTrunks = trunks.filter((t) => t.companyId === formCompanyId)
    const {
        routes,
        allRoutes,
        loading,
        filter,
        setFilter,
        createRoute,
        updateRoute,
        deleteRoute,
    } = useInboundRoutes(formCompanyId)
    const companyRoutes = routes.filter(
        (r) => companyFilter === "all" || r.companyId === companyFilter
    )

    const { paginated, page, setPage, totalPages, total } = usePagination(companyRoutes, 15)

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
                    disabled={companyFilter === "all"}
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

            <InboundRoutesTable
                routes={paginated}
                loading={loading}
                onEdit={setEditRoute}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && companyFilter !== "all" && (
                <InboundRouteFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    route={null}
                    companyId={formCompanyId!}
                    dids={formDids}
                    trunks={formTrunks}
                    existingRoutes={allRoutes}
                    onSave={createRoute}
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
                        updateRoute(editRoute.id, { name: form.name, destination: form.destination })
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
