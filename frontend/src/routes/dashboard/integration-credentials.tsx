import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { IntegrationCredentialFormDialog } from "@/components/Integrations/integration-credential-form-dialog"
import { IntegrationCredentialsTable } from "@/components/Integrations/integration-credentials-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useIntegrationCredentials, type IntegrationCredential } from "@/hooks/use-integration-credentials"

function IntegrationCredentialsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        integrationCredentials,
        loading,
        filter,
        setFilter,
        createIntegrationCredential,
        updateIntegrationCredential,
        deleteIntegrationCredential,
    } = useIntegrationCredentials(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editIntegrationCredential, setEditIntegrationCredential] = useState<IntegrationCredential | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<IntegrationCredential | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(integrationCredentials, 15)

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteIntegrationCredential(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Credenciais de integração"
                description="Base URL e token de acesso a APIs de terceiros, reutilizáveis por vários nós de flow"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova credencial
                </Button>
            </PageHeader>

            <FilterBar>
                <Input
                    placeholder="Buscar por nome..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full md:max-w-sm"
                />
                <CompanyFilter companies={companies} value={companyFilter} onValueChange={setCompanyFilter} />
            </FilterBar>

            <IntegrationCredentialsTable
                integrationCredentials={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditIntegrationCredential}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && (
                <IntegrationCredentialFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    integrationCredential={null}
                    companies={companies}
                    onSave={(form) => createIntegrationCredential(form, form.companyId)}
                />
            )}

            {editIntegrationCredential && (
                <IntegrationCredentialFormDialog
                    open={!!editIntegrationCredential}
                    onOpenChange={(open) => !open && setEditIntegrationCredential(null)}
                    integrationCredential={editIntegrationCredential}
                    companies={companies}
                    onSave={(form) => updateIntegrationCredential(editIntegrationCredential.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar credencial de integração"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/integration-credentials")({
    component: IntegrationCredentialsPage,
})
