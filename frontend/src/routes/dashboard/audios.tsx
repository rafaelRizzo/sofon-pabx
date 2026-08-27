import { createFileRoute } from "@tanstack/react-router"


import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { AudioFormDialog } from "@/components/Audios/audio-form-dialog"
import { AudiosTable } from "@/components/Audios/audios-table"
import { AudioPlayerDialog } from "@/components/audio-player-dialog"
import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAudios, type Audio } from "@/hooks/use-audios"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { usePagination } from "@/hooks/use-pagination"

function AudiosPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const [createOpen, setCreateOpen] = useState(false)
    const [editAudio, setEditAudio] = useState<Audio | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Audio | null>(null)
    const [playAudio, setPlayAudio] = useState<Audio | null>(null)

    // Empresa usada no dialog (não deixa escolher empresa lá dentro): a do áudio em edição, ou
    // o filtro da tabela - mesmo padrão de Announcements/InboundRoutes
    const formCompanyId = editAudio?.companyId ?? companyFilter

    const {
        audios,
        loading,
        filter,
        setFilter,
        createAudio,
        createAudioFromText,
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
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={!companyFilter}
                >
                    <PlusIcon />
                    Enviar áudio
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

            <AudiosTable
                audios={paginated}
                loading={loading}
                companySelected={!!companyFilter}
                onPlay={setPlayAudio}
                onEdit={setEditAudio}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            {createOpen && companyFilter && (
                <AudioFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    audio={null}
                    companyId={formCompanyId!}
                    onSave={(form, file, tts) =>
                        tts
                            ? createAudioFromText(
                                  form.name,
                                  formCompanyId!,
                                  tts.text,
                                  tts.voiceId,
                                  tts.language
                              )
                            : createAudio(file!, form.name, formCompanyId!)
                    }
                />
            )}

            {editAudio && (
                <AudioFormDialog
                    open={!!editAudio}
                    onOpenChange={(open) => !open && setEditAudio(null)}
                    audio={editAudio}
                    companyId={formCompanyId!}
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

            <AudioPlayerDialog
                audioId={playAudio?.id ?? null}
                name={playAudio?.name}
                onOpenChange={(open) => !open && setPlayAudio(null)}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/audios")({
  component: AudiosPage,
})
