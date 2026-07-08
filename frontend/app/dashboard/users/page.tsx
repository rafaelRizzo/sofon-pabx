"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { UserFormDialog } from "@/components/Users/user-form-dialog"
import { UsersTable } from "@/components/Users/users-table"
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
import { useUsers, type CreateUserForm, type User } from "@/hooks/use-users"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

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

    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const filteredUsers =
        companyFilter === "all"
            ? users
            : users.filter((u) => u.companies.some((c) => c.id === companyFilter))

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
                    <ComboboxInput
                        placeholder="Buscar empresa..."
                        className="w-56"
                    />
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
