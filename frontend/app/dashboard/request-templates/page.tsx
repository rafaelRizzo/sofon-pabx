"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { RequestTemplateFormDialog } from "@/components/RequestTemplates/request-template-form-dialog"
import { RequestTemplatesTable } from "@/components/RequestTemplates/request-templates-table"
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
import { useRequestTemplates, type RequestTemplate } from "@/hooks/use-request-templates"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function RequestTemplatesPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const {
        requestTemplates,
        loading,
        filter,
        setFilter,
        createRequestTemplate,
        updateRequestTemplate,
        deleteRequestTemplate,
    } = useRequestTemplates(companyFilter === "all" ? undefined : companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editRequestTemplate, setEditRequestTemplate] = useState<RequestTemplate | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<RequestTemplate | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(requestTemplates, 15)

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
                <Combobox<CompanyFilterOption>
                    items={[ALL_COMPANIES, ...companies]}
                    value={[ALL_COMPANIES, ...companies].find((c) => c.id === companyFilter) ?? ALL_COMPANIES}
                    itemToStringLabel={(c) => c.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(company) => setCompanyFilter(company?.id ?? "all")}
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

            <RequestTemplatesTable
                requestTemplates={paginated}
                loading={loading}
                onEdit={setEditRequestTemplate}
                onDelete={setDeleteTarget}
            />

            <DataPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            {createOpen && (
                <RequestTemplateFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    requestTemplate={null}
                    companies={companies}
                    onSave={(form) => createRequestTemplate(form, form.companyId)}
                />
            )}

            {editRequestTemplate && (
                <RequestTemplateFormDialog
                    open={!!editRequestTemplate}
                    onOpenChange={(open) => !open && setEditRequestTemplate(null)}
                    requestTemplate={editRequestTemplate}
                    companies={companies}
                    onSave={(form) => updateRequestTemplate(editRequestTemplate.id, form)}
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
