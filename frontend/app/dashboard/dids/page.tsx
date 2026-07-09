"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { DidFormDialog } from "@/components/Dids/did-form-dialog"
import { DidsTable } from "@/components/Dids/dids-table"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useDids, type Did } from "@/hooks/use-dids"
import { usePagination } from "@/hooks/use-pagination"

type CompanyFilterOption = { id: string; name: string }

const ALL_COMPANIES: CompanyFilterOption = { id: "all", name: "Todas as empresas" }

export default function DidsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useState<string>("all")

    const { dids, loading, filter, setFilter, createDid, updateDid, deleteDid } =
        useDids(companyFilter === "all" ? undefined : companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editDid, setEditDid] = useState<Did | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Did | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        dids,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteDid(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="DIDs"
                description="Gerencie os números DID das empresas"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Novo DID
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por número..."
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

            <DidsTable
                dids={paginated}
                companies={companies}
                loading={loading}
                onEdit={setEditDid}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            <DidFormDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                did={null}
                companies={companies}
                onCreate={createDid}
            />

            {editDid && (
                <DidFormDialog
                    open={!!editDid}
                    onOpenChange={(open) => !open && setEditDid(null)}
                    did={editDid}
                    companies={companies}
                    onUpdate={(form) => updateDid(editDid.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar DID"
                itemName={deleteTarget?.number}
                onConfirm={handleDelete}
            />
        </div>
    )
}
