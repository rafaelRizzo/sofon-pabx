import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { AnnouncementFormDialog } from "@/components/Announcements/announcement-form-dialog"
import { AnnouncementsTable } from "@/components/Announcements/announcements-table"
import { AudioPlayerDialog } from "@/components/audio-player-dialog"
import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAnnouncements, type Announcement } from "@/hooks/use-announcements"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"

function AnnouncementsPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const [createOpen, setCreateOpen] = useState(false)
    const [editAnnouncement, setEditAnnouncement] =
        useState<Announcement | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
    const [playAnnouncement, setPlayAnnouncement] =
        useState<Announcement | null>(null)

    // Empresa usada para escopar áudios/opções de destino do formulário (o dialog não deixa
    // escolher empresa): a do anúncio em edição, ou o filtro da tabela
    const formCompanyId = editAnnouncement?.companyId ?? companyFilter

    const {
        announcements,
        loading,
        filter,
        setFilter,
        createAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
    } = useAnnouncements(companyFilter)

    const { paginated, page, setPage, totalPages, total } = usePagination(
        announcements,
        15
    )

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteAnnouncement(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Anúncios"
                description="Gerencie mensagens de áudio que podem ser usadas como destino em rotas, filas e URAs"
            >
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={!companyFilter}
                >
                    <PlusIcon />
                    Novo anúncio
                </Button>
            </PageHeader>

            <FilterBar>
                <Input
                    placeholder="Buscar por nome..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full md:max-w-sm"
                />
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
            </FilterBar>

            <AnnouncementsTable
                announcements={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onPlay={setPlayAnnouncement}
                onEdit={setEditAnnouncement}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && companyFilter && (
                <AnnouncementFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    announcement={null}
                    companyId={formCompanyId!}
                    onSave={(form) => createAnnouncement(form, formCompanyId!)}
                />
            )}

            {editAnnouncement && (
                <AnnouncementFormDialog
                    open={!!editAnnouncement}
                    onOpenChange={(open) => !open && setEditAnnouncement(null)}
                    announcement={editAnnouncement}
                    companyId={formCompanyId!}
                    onSave={(form) =>
                        updateAnnouncement(editAnnouncement.id, form)
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar anúncio"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />

            <AudioPlayerDialog
                audioId={playAnnouncement?.audioId ?? null}
                name={playAnnouncement?.name}
                onOpenChange={(open) => !open && setPlayAnnouncement(null)}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/announcements")({
  component: AnnouncementsPage,
})
