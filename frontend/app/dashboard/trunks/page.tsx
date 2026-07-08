"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { TrunkFormDialog } from "@/components/Trunks/trunk-form-dialog"
import { TrunksTable } from "@/components/Trunks/trunks-table"
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
import { usePagination } from "@/hooks/use-pagination"
import { useTrunks, type Trunk } from "@/hooks/use-trunks"

export default function TrunksPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useState<string>("")

    useEffect(() => {
        if (!companyId && companies.length > 0) {
            setCompanyId(companies[0].id)
        }
    }, [companies, companyId])

    const {
        trunks,
        loading,
        filter,
        setFilter,
        createTrunk,
        updateTrunk,
        deleteTrunk,
    } = useTrunks(companyId)

    const [createOpen, setCreateOpen] = useState(false)
    const [editTrunk, setEditTrunk] = useState<Trunk | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Trunk | null>(null)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        trunks,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteTrunk(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Troncos"
                description="Gerencie os troncos SIP de entrada e saída"
            >
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={!companyId}
                >
                    <PlusIcon />
                    Novo tronco
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome, host..."
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
                    <ComboboxInput
                        placeholder="Buscar empresa..."
                        className="w-56"
                    />
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

            <TrunksTable
                trunks={paginated}
                loading={loading}
                onEdit={setEditTrunk}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && companyId && (
                <TrunkFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    trunk={null}
                    companies={companies}
                    onCreate={createTrunk}
                />
            )}

            {editTrunk && (
                <TrunkFormDialog
                    open={!!editTrunk}
                    onOpenChange={(open) => !open && setEditTrunk(null)}
                    trunk={editTrunk}
                    companies={companies}
                    onUpdate={(form) => updateTrunk(editTrunk.id, form)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar tronco"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
