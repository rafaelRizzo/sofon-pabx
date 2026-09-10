import { type Audio } from "@/hooks/use-audios"
import type { AudioFormValues, TtsPayload } from "@/components/Audios/audio-form-dialog"

export type AudioFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    audio: Audio | null
    // empresa já escolhida na tela (filtro da tabela, ou a do áudio em edição) - não dá pra
    // trocar dentro do dialog, mesmo padrão de AnnouncementFormDialog/InboundRouteFormDialog
    companyId: string
    // null = falhou; string = audioId criado/editado (usado pra mostrar o preview após TTS)
    onSave: (
        form: AudioFormValues,
        file: File | null,
        tts: TtsPayload | null
    ) => Promise<string | null>
}

export type AudiosTableProps = {
    audios: Audio[]
    loading: boolean
    companySelected: boolean
    onPlay: (audio: Audio) => void
    onEdit: (audio: Audio) => void
    onDelete: (audio: Audio) => void
}
