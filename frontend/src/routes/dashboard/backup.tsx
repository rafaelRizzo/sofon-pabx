import { createFileRoute } from "@tanstack/react-router"

import { useRef, useState } from "react"
import {
    AlertCircleIcon,
    CheckCircle2Icon,
    DownloadIcon,
    FileJsonIcon,
    UploadIcon,
    XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { RestoreBackupDialog } from "@/components/Backup/restore-backup-dialog"
import { CompanyFilter } from "@/components/company-filter"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import {
    parseBackupFile,
    useBackupExport,
    useBackupRestore,
    type BackupPayload,
} from "@/hooks/use-backup"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"

function BackupPage() {
    const { user } = useAuth()
    const isAdmin = user?.role === "admin"

    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    const { exporting, exportBackup } = useBackupExport()
    const { restoring, results, restore } = useBackupRestore()

    const [payload, setPayload] = useState<BackupPayload | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = e.target.files?.[0] ?? null
        if (!selected) return
        try {
            setPayload(await parseBackupFile(selected))
            setFileName(selected.name)
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Arquivo inválido"
            )
            setPayload(null)
            setFileName(null)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    function clearFile() {
        setPayload(null)
        setFileName(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    async function handleConfirmRestore() {
        if (!payload) return
        await restore(payload)
        setConfirmOpen(false)
        clearFile()
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Backup"
                description="Exporte ou restaure a configuração completa de uma empresa (ramais, troncos, filas, rotas, URAs, áudios, credenciais e fluxos)"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Exportar</CardTitle>
                    <CardDescription>
                        Gera um arquivo .json autocontido (áudios embutidos em
                        base64) com toda a configuração da empresa
                        selecionada
                        {isAdmin && ", ou de todas as empresas de uma vez"}.
                        O arquivo contém segredos em texto puro (senha de
                        tronco, token de integração) — trate-o como um
                        segredo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <CompanyFilter
                        companies={companies}
                        value={companyId}
                        onValueChange={setCompanyId}
                        showAllOption={isAdmin}
                        className="w-full sm:w-72"
                    />
                    <Button
                        onClick={() => exportBackup(companyId)}
                        disabled={exporting || (!companyId && !isAdmin)}
                    >
                        <DownloadIcon />
                        {companyId ? "Exportar empresa" : "Exportar todas"}
                    </Button>
                </CardContent>
            </Card>

            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>Restaurar</CardTitle>
                        <CardDescription>
                            Recria empresa(s) a partir de um arquivo de
                            backup. Nunca sobrescreve uma empresa existente —
                            sempre cria uma nova, com todos os ids
                            remapeados. Senha de ramal é sempre regenerada
                            (nunca preservada). Só admin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {fileName ? (
                                <div className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm sm:w-72">
                                    <FileJsonIcon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate">
                                        {fileName}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={clearFile}
                                    >
                                        <XIcon />
                                        <span className="sr-only">
                                            Remover arquivo
                                        </span>
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full sm:w-72"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <UploadIcon />
                                    Selecionar arquivo .json
                                </Button>
                            )}
                            <Button
                                onClick={() => setConfirmOpen(true)}
                                disabled={!payload || restoring}
                            >
                                Restaurar
                            </Button>
                        </div>

                        {results && (
                            <div className="flex flex-col gap-2">
                                {results.map((r, i) => (
                                    <Alert
                                        key={i}
                                        variant={
                                            r.error ? "destructive" : "default"
                                        }
                                    >
                                        {r.error ? (
                                            <AlertCircleIcon />
                                        ) : (
                                            <CheckCircle2Icon />
                                        )}
                                        <AlertTitle>{r.originalName}</AlertTitle>
                                        <AlertDescription>
                                            {r.error ??
                                                `Restaurada com sucesso (id: ${r.newCompanyId})`}
                                        </AlertDescription>
                                    </Alert>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <RestoreBackupDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                payload={payload}
                restoring={restoring}
                onConfirm={handleConfirmRestore}
                onDownloadCurrent={() => exportBackup()}
                downloadingCurrent={exporting}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/backup")({
    component: BackupPage,
})
