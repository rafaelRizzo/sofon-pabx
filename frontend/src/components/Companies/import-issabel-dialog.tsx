"use client"

import { useRef, useState } from "react"
import {
    ArchiveIcon,
    CheckCircle2Icon,
    InfoIcon,
    TriangleAlertIcon,
    UploadIcon,
    XIcon,
} from "lucide-react"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { extractIssabelSql } from "@/lib/issabel-extract"
import {
    useIssabelImport,
    type ImportIssabelSummary,
    type ImportResult,
} from "@/hooks/use-issabel-import"
import { type ImportIssabelDialogProps } from "@/components/Companies/types"

const BACKUP_ACCEPT = ".tar,.tgz,.gz,.sql"

// Backup completo pode ter GBs de gravação/voicemail - tentamos extrair só o asterisk.sql aqui no
// navegador (issabel-extract.ts) antes de enviar, pra nunca subir isso à toa. Se não conseguir
// (formato inesperado, navegador sem suporte a DecompressionStream), caímos pra enviar o arquivo
// como veio - a API aceita o .tar/.tgz completo direto e extrai no servidor (mais lento, mas funciona).
async function prepareUpload(
    file: File
): Promise<{ upload: File; extracted: boolean }> {
    if (file.name.toLowerCase().endsWith(".sql")) {
        return { upload: file, extracted: false }
    }
    try {
        const sql = await extractIssabelSql(file)
        return {
            upload: new File([sql], "asterisk.sql", { type: "text/plain" }),
            extracted: true,
        }
    } catch (err) {
        console.warn(
            "Extração local do backup Issabel falhou, enviando arquivo completo",
            err
        )
        return { upload: file, extracted: false }
    }
}

function ResultSection({
    label,
    result,
    extra,
}: {
    label: string
    result: ImportResult
    extra?: string
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                <Badge variant="secondary">{result.created} criado(s)</Badge>
                {extra && <Badge variant="outline">{extra}</Badge>}
                {result.warnings.length > 0 && (
                    <Badge variant="destructive">
                        {result.warnings.length} aviso(s)
                    </Badge>
                )}
            </div>
            {result.warnings.length > 0 && (
                <ul className="space-y-0.5 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                    {result.warnings.map((w, i) => (
                        <li key={i} className="flex gap-1.5">
                            <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export function ImportIssabelDialog({
    open,
    onOpenChange,
    companyId,
    companyName,
}: ImportIssabelDialogProps) {
    const { importIssabelBackup, importing } = useIssabelImport()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const [preparing, setPreparing] = useState(false)
    const [summary, setSummary] = useState<ImportIssabelSummary | null>(null)

    function reset() {
        setFile(null)
        setSummary(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    function handleOpenChange(next: boolean) {
        if (!next) reset()
        onOpenChange(next)
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setDragOver(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) setFile(dropped)
    }

    async function handleImport() {
        if (!file) return
        setPreparing(true)
        const { upload } = await prepareUpload(file).finally(() =>
            setPreparing(false)
        )
        const result = await importIssabelBackup(companyId, upload)
        if (result) setSummary(result)
    }

    const busy = preparing || importing

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Importar backup do IssabelPBX</DialogTitle>
                    <DialogDescription>
                        Importa ramais, filas e troncos do backup pra empresa
                        "{companyName}". Ramal recebe senha nova (nunca
                        preserva a original) e tronco entra sempre sem
                        registro de saída ativo, por segurança - ativar fica a
                        cargo do admin depois.
                    </DialogDescription>
                </DialogHeader>

                {summary ? (
                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-4 pr-3">
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                <CheckCircle2Icon className="size-4" />
                                Import concluído
                            </div>
                            <ResultSection label="Ramais" result={summary.extensions} />
                            <Separator />
                            <ResultSection label="Troncos" result={summary.trunks} />
                            <Separator />
                            <ResultSection label="Filas" result={summary.queues} />
                            <Separator />
                            <ResultSection
                                label="Membros de fila"
                                result={summary.queueMembers}
                                extra={
                                    summary.queueMembers.skippedAgents > 0
                                        ? `${summary.queueMembers.skippedAgents} agente(s) dinâmico(s) ignorado(s)`
                                        : undefined
                                }
                            />
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="space-y-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={BACKUP_ACCEPT}
                            className="hidden"
                            onChange={(e) =>
                                setFile(e.target.files?.[0] ?? null)
                            }
                        />
                        {file ? (
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                <ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">
                                    {file.name}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => setFile(null)}
                                >
                                    <XIcon />
                                    <span className="sr-only">
                                        Remover arquivo
                                    </span>
                                </Button>
                            </div>
                        ) : (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        fileInputRef.current?.click()
                                    }
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOver(true)
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                className={cn(
                                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors hover:border-foreground/25 hover:bg-accent/40",
                                    dragOver &&
                                        "border-foreground/40 bg-accent/50"
                                )}
                            >
                                <UploadIcon className="size-5 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                    Arraste o backup ou clique para selecionar
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Arquivo .tar completo do Issabel, o
                                    mysqldb_asterisk.tgz ou o asterisk.sql já
                                    extraído
                                </p>
                            </div>
                        )}
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Se enviar o backup completo, o navegador tenta
                                extrair só o dump do banco antes de enviar -
                                evita subir gravação/voicemail à toa. Se não
                                conseguir, o arquivo inteiro é enviado e a
                                extração acontece no servidor.
                            </span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {summary ? (
                        <Button onClick={() => handleOpenChange(false)}>
                            Fechar
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={busy}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleImport} disabled={!file || busy}>
                                {preparing
                                    ? "Processando arquivo..."
                                    : importing
                                      ? "Importando..."
                                      : "Importar"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
