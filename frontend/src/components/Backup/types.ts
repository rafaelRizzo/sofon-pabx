import { type BackupPayload } from "@/hooks/use-backup"

export type RestoreBackupDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    payload: BackupPayload | null
    restoring: boolean
    onConfirm: () => void
    // backup de segurança do estado ATUAL (todas as empresas) - obrigatório antes de liberar
    // o "Continuar", pra sempre ter como reverter manualmente se o restore der problema
    onDownloadCurrent: () => Promise<void>
    downloadingCurrent: boolean
}
