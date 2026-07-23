import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { RequestTemplateFormDialog } from "@/components/RequestTemplates/request-template-form-dialog"
import { RequestTemplatesTable } from "@/components/RequestTemplates/request-templates-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import {
    useRequestTemplates,
    type RequestTemplate,
} from "@/hooks/use-request-templates"

function RequestTemplatesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        requestTemplates,
        loading,
        filter,
        setFilter,
        createRequestTemplate,
        updateRequestTemplate,
        deleteRequestTemplate,
    } = useRequestTemplates(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editRequestTemplate, setEditRequestTemplate] =
        useState<RequestTemplate | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<RequestTemplate | null>(
        null
    )

    const { paginated, page, setPage, totalPages, total } = usePagination(
        requestTemplates,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteRequestTemplate(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Templates de requisição"
                description="Dispare requisições HTTP durante a chamada e roteie pelo resultado"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo template
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome ou URL..."
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

            <RequestTemplatesTable
                requestTemplates={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditRequestTemplate}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <RequestTemplateFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    requestTemplate={null}
                    companies={companies}
                    onSave={(form) =>
                        createRequestTemplate(form, form.companyId)
                    }
                />
            )}

            {editRequestTemplate && (
                <RequestTemplateFormDialog
                    open={!!editRequestTemplate}
                    onOpenChange={(open) =>
                        !open && setEditRequestTemplate(null)
                    }
                    requestTemplate={editRequestTemplate}
                    companies={companies}
                    onSave={(form) =>
                        updateRequestTemplate(editRequestTemplate.id, form)
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar template de requisição"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/request-templates")({
  component: RequestTemplatesPage,
})
