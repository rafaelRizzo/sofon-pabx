"use client"

import { useEffect, useState } from "react"
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
import { useCompanies, type Company } from "@/hooks/use-companies"
import { useDids } from "@/hooks/use-dids"
import { useInboundRoutes, type InboundRoute } from "@/hooks/use-inbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

export default function InboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useState<string>("")

    useEffect(() => {
        if (!companyId && companies.length > 0) {
            setCompanyId(companies[0].id)
        }
    }, [companies, companyId])

    const { dids } = useDids()
    const companyDids = dids.filter((d) => d.companyId === companyId)
    const { trunks } = useTrunks(companyId)
    const {
        routes,
        allRoutes,
        loading,
        filter,
        setFilter,
        createRoute,
        updateRoute,
        deleteRoute,
    } = useInboundRoutes(companyId)

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<InboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<InboundRoute | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(routes, 15)

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
                <Button onClick={() => setCreateOpen(true)} disabled={!companyId}>
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
                <Combobox<Company>
                    items={companies}
                    value={companies.find((c) => c.id === companyId) ?? null}
                    itemToStringLabel={(c) => c.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(company) => setCompanyId(company?.id ?? "")}
                >
                    <ComboboxInput placeholder="Buscar empresa..." className="w-56" />
                    <ComboboxContent>
                        <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                        <ComboboxList>
                            {(company: Company) => (
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
                companyId={companyId}
                onEdit={setEditRoute}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && companyId && (
                <InboundRouteFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    route={null}
                    companyId={companyId}
                    dids={companyDids}
                    trunks={trunks}
                    existingRoutes={allRoutes}
                    onSave={createRoute}
                />
            )}

            {editRoute && (
                <InboundRouteFormDialog
                    open={!!editRoute}
                    onOpenChange={(open) => !open && setEditRoute(null)}
                    route={editRoute}
                    companyId={companyId}
                    dids={companyDids}
                    trunks={trunks}
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
