"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { TrunkFormDialog } from "@/components/Trunks/trunk-form-dialog"
import { TrunksTable } from "@/components/Trunks/trunks-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCompanies } from "@/hooks/use-companies"
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
                <Select
                    items={companies.map((c) => ({ value: c.id, label: c.name }))}
                    value={companyId}
                    onValueChange={(v) => setCompanyId(v as string)}
                >
                    <SelectTrigger className="w-56">
                        <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                        {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    placeholder="Buscar por nome, host..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm"
                />
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
