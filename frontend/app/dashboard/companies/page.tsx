"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFormDialog } from "@/components/Companies/company-form-dialog"
import { CompaniesTable } from "@/components/Companies/companies-table"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    useCompanies,
    type Company,
    type CompanyForm,
} from "@/hooks/use-companies"
import { usePagination } from "@/hooks/use-pagination"

export default function CompaniesPage() {
    const {
        companies,
        loading,
        filter,
        setFilter,
        createCompany,
        updateCompany,
        deleteCompany,
        resyncDialplan,
    } = useCompanies()

    const { paginated, page, setPage, totalPages, total } = usePagination(
        companies,
        10
    )

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<Company | null>(null)
    const [deleting, setDeleting] = useState<Company | null>(null)

    const openCreate = () => {
        setEditing(null)
        setFormOpen(true)
    }

    const openEdit = (company: Company) => {
        setEditing(company)
        setFormOpen(true)
    }

    const handleSave = (form: CompanyForm) =>
        editing ? updateCompany(editing.id, form) : createCompany(form)

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Empresas"
                description="Gerencie as empresas do PABX"
            >
                <Button onClick={openCreate}>
                    <PlusIcon />
                    Nova empresa
                </Button>
            </PageHeader>

            <Input
                placeholder="Filtrar por nome ou documento..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
            />

            <CompaniesTable
                companies={paginated}
                loading={loading}
                onEdit={openEdit}
                onDelete={setDeleting}
                onResyncDialplan={(company) => resyncDialplan(company.id)}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            <CompanyFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                company={editing}
                onSave={handleSave}
            />

            <ConfirmDeleteDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Deletar empresa"
                itemName={deleting?.name}
                onConfirm={() =>
                    deleting
                        ? deleteCompany(deleting.id)
                        : Promise.resolve(true)
                }
            />
        </div>
    )
}
