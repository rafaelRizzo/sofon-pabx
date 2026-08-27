"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    DownloadIcon,
    InfoIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { summarizeBackup, type BackupPayload } from "@/hooks/use-backup"

const CONFIRM_WORD = "RESTAURAR"

type Props = {
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

export function RestoreBackupDialog({
    open,
    onOpenChange,
    payload,
    restoring,
    onConfirm,
    onDownloadCurrent,
    downloadingCurrent,
}: Props) {
    const [step, setStep] = useState<1 | 2>(1)
    const [confirmText, setConfirmText] = useState("")
    const [downloadedCurrent, setDownloadedCurrent] = useState(false)

    // reabrir sempre volta pro passo 1 e exige baixar o backup atual de novo - evita pular a
    // etapa de revisão/segurança se o dialog for fechado e reaberto (com o mesmo arquivo ou não)
    useEffect(() => {
        if (open) {
            setStep(1)
            setConfirmText("")
            setDownloadedCurrent(false)
        }
    }, [open])

    async function handleDownloadCurrent() {
        await onDownloadCurrent()
        setDownloadedCurrent(true)
    }

    if (!payload) return null

    const summary = summarizeBackup(payload)
    const totalEntities = summary.companies.reduce(
        (sum, c) => sum + c.entityCount,
        0
    )
    const generatedAtLabel = (() => {
        try {
            return format(new Date(summary.generatedAt), "dd/MM/yyyy HH:mm", {
                locale: ptBR,
            })
        } catch {
            return summary.generatedAt
        }
    })()

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!restoring) onOpenChange(next)
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === 1
                            ? "Revisar backup antes de restaurar"
                            : "Confirmação final"}
                    </DialogTitle>
                    <DialogDescription>
                        Backup gerado em {generatedAtLabel}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 rounded-md border p-3">
                            <p className="text-sm font-medium">
                                Backup de segurança do estado atual
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Antes de continuar, baixe um backup de tudo
                                que existe agora no sistema (todas as
                                empresas) - assim você tem como reverter
                                manualmente se algo der errado.
                            </p>
                            <Button
                                type="button"
                                variant={
                                    downloadedCurrent ? "outline" : "default"
                                }
                                disabled={downloadingCurrent}
                                onClick={handleDownloadCurrent}
                            >
                                {downloadedCurrent ? (
                                    <>
                                        <CheckCircle2Icon />
                                        Backup atual baixado
                                    </>
                                ) : downloadingCurrent ? (
                                    "Baixando..."
                                ) : (
                                    <>
                                        <DownloadIcon />
                                        Baixar backup atual
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {summary.companies.map((c, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                >
                                    <span className="truncate">{c.name}</span>
                                    <Badge
                                        variant="outline"
                                        className="border-transparent bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300"
                                    >
                                        {c.entityCount} recurso(s)
                                    </Badge>
                                </div>
                            ))}
                        </div>

                        <Alert>
                            <InfoIcon />
                            <AlertTitle>
                                Vai criar até {summary.companies.length}{" "}
                                empresa(s) nova(s)
                            </AlertTitle>
                            <AlertDescription>
                                Nunca sobrescreve uma empresa existente. Cada
                                empresa do arquivo é recriada do zero, com
                                todos os IDs remapeados, e a senha de ramal é
                                sempre regenerada (nunca a original). Se já
                                existir uma empresa com o mesmo nome, aquela
                                empresa específica é pulada e reportada como
                                erro, sem criar duplicata. Usuários do painel
                                vinculados à empresa são restaurados com a
                                senha original - se o username já existir, só
                                aquele usuário é pulado (não afeta o resto da
                                empresa).
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <Alert variant="destructive">
                            <AlertTriangleIcon />
                            <AlertTitle>Ação irreversível</AlertTitle>
                            <AlertDescription>
                                {summary.companies.length} empresa(s),{" "}
                                {totalEntities} recurso(s) no total serão
                                criados agora. Pra confirmar, digite{" "}
                                <strong>{CONFIRM_WORD}</strong> abaixo.
                            </AlertDescription>
                        </Alert>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="restore-confirm">
                                Digite {CONFIRM_WORD} pra confirmar
                            </Label>
                            <Input
                                id="restore-confirm"
                                autoComplete="off"
                                value={confirmText}
                                onChange={(e) =>
                                    setConfirmText(e.target.value)
                                }
                                placeholder={CONFIRM_WORD}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 1 ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                disabled={!downloadedCurrent}
                                onClick={() => setStep(2)}
                            >
                                Continuar
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                disabled={restoring}
                                onClick={() => setStep(1)}
                            >
                                Voltar
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={
                                    confirmText !== CONFIRM_WORD || restoring
                                }
                                onClick={onConfirm}
                            >
                                {restoring
                                    ? "Restaurando..."
                                    : "Restaurar agora"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
