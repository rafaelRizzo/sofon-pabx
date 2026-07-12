"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { UserFormDialog } from "@/components/Users/user-form-dialog"
import { UsersTable } from "@/components/Users/users-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"
import { useUsers, type CreateUserForm, type User } from "@/hooks/use-users"

export default function UsersPage() {
    const {
        users,
        loading,
        filter,
        setFilter,
        createUser,
        updateUser,
        deleteUser,
    } = useUsers()
    const { companies } = useCompanies()

    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const filteredUsers = companyFilter
        ? users.filter((u) => u.companies.some((c) => c.id === companyFilter))
        : []

    const { paginated, page, setPage, totalPages, total } = usePagination(
        filteredUsers,
        10
    )

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<User | null>(null)
    const [deleting, setDeleting] = useState<User | null>(null)

    const openCreate = () => {
        setEditing(null)
        setFormOpen(true)
    }

    const openEdit = (user: User) => {
        setEditing(user)
        setFormOpen(true)
    }

    const handleSave = (form: CreateUserForm) =>
        editing ? updateUser(editing.id, form) : createUser(form)

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Usuários"
                description="Gerencie os usuários do painel"
            >
                <Button onClick={openCreate}>
                    <PlusIcon />
                    Novo usuário
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Filtrar por nome ou e-mail..."
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

            <UsersTable
                users={paginated}
                loading={loading}
                onEdit={openEdit}
                onDelete={setDeleting}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            <UserFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                user={editing}
                onSave={handleSave}
            />

            <ConfirmDeleteDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Deletar usuário"
                itemName={deleting?.name}
                onConfirm={() =>
                    deleting ? deleteUser(deleting.id) : Promise.resolve(true)
                }
            />
        </div>
    )
}
