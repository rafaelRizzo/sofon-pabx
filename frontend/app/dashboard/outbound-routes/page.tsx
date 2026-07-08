"use client"

import { useEffect, useState } from "react"
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
import { useCompanies, type Company } from "@/hooks/use-companies"
import { useExtensions } from "@/hooks/use-extensions"
import { useOutboundRoutes, type OutboundRoute } from "@/hooks/use-outbound-routes"
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks } from "@/hooks/use-trunks"

export default function OutboundRoutesPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useState<string>("")

    useEffect(() => {
        if (!companyId && companies.length > 0) {
            setCompanyId(companies[0].id)
        }
    }, [companies, companyId])

    const { trunks } = useTrunks(companyId)
    const { extensions } = useExtensions()
    const companyExtensions = extensions.filter((e) => e.companyId === companyId)
    const {
        routes,
        allRoutes,
        loading,
        filter,
        setFilter,
        createRoute,
        updateRoute,
        deleteRoute,
    } = useOutboundRoutes(companyId)

    const [createOpen, setCreateOpen] = useState(false)
    const [editRoute, setEditRoute] = useState<OutboundRoute | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<OutboundRoute | null>(null)

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
                <Button onClick={() => setCreateOpen(true)} disabled={!companyId}>
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

            <OutboundRoutesTable
                routes={paginated}
                trunks={trunks}
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

            {createOpen && companyId && (
                <OutboundRouteFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    route={null}
                    trunks={trunks}
                    extensions={companyExtensions}
                    existingRoutes={allRoutes}
                    onSave={createRoute}
                />
            )}

            {editRoute && (
                <OutboundRouteFormDialog
                    open={!!editRoute}
                    onOpenChange={(open) => !open && setEditRoute(null)}
                    route={editRoute}
                    trunks={trunks}
                    extensions={companyExtensions}
                    existingRoutes={allRoutes}
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
