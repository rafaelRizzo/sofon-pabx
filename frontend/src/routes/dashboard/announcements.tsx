import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { AnnouncementFormDialog } from "@/components/Announcements/announcement-form-dialog"
import { AnnouncementsTable } from "@/components/Announcements/announcements-table"
import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
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

            <AnnouncementsTable
                announcements={paginated}
                loading={loading}
                companySelected={!!companyFilter}
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
        </div>
    )
}

export const Route = createFileRoute("/dashboard/announcements")({
  component: AnnouncementsPage,
})
