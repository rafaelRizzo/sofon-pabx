"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { AudioFormDialog } from "@/components/Audios/audio-form-dialog"
import { AudiosTable } from "@/components/Audios/audios-table"
import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAudios, type Audio } from "@/hooks/use-audios"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"

export default function AudiosPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const [createOpen, setCreateOpen] = useState(false)
    const [editAudio, setEditAudio] = useState<Audio | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Audio | null>(null)

    const {
        audios,
        loading,
        filter,
        setFilter,
        createAudio,
        updateAudio,
        deleteAudio,
    } = useAudios(companyFilter)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        audios,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteAudio(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Áudios"
                description="Gerencie os arquivos de áudio usados por anúncios, URAs e filas"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Enviar áudio
                </Button>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por nome..."
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

            <AudiosTable
                audios={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onEdit={setEditAudio}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && (
                <AudioFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    audio={null}
                    companies={companies}
                    onSave={(form, file) =>
                        createAudio(file!, form.name, form.companyId)
                    }
                />
            )}

            {editAudio && (
                <AudioFormDialog
                    open={!!editAudio}
                    onOpenChange={(open) => !open && setEditAudio(null)}
                    audio={editAudio}
                    companies={companies}
                    onSave={(form) => updateAudio(editAudio.id, form.name)}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar áudio"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}
