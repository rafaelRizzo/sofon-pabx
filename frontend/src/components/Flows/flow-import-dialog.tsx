"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { AlertTriangleIcon, FileJsonIcon, UploadIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    parseFlowExportFile,
    useFlowImport,
    type FlowExportBundle,
    type FlowImportPreview,
    type FlowImportResolutions,
} from "@/hooks/use-flow-transfer"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    onImported: (flowId: string) => void
}

export function FlowImportDialog({ open, onOpenChange, companyId, onImported }: Props) {
    const { analyzing, importing, previewImport, importFlow } = useFlowImport()

    const [fileName, setFileName] = useState<string | null>(null)
    const [bundle, setBundle] = useState<FlowExportBundle | null>(null)
    const [preview, setPreview] = useState<FlowImportPreview | null>(null)
    const [resolutions, setResolutions] = useState<FlowImportResolutions>({
        extensions: {},
        credentials: {},
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            setFileName(null)
            setBundle(null)
            setPreview(null)
            setResolutions({ extensions: {}, credentials: {} })
        }
    }, [open])

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = e.target.files?.[0] ?? null
        if (!selected) return
        try {
            const parsed = await parseFlowExportFile(selected)
            setFileName(selected.name)
            setBundle(parsed)
            setPreview(null)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Arquivo inválido")
            clearFile()
        }
    }

    function clearFile() {
        setFileName(null)
        setBundle(null)
        setPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    async function handleAnalyze() {
        if (!bundle) return
        const result = await previewImport(bundle, companyId)
        if (result) setPreview(result)
    }

    async function handleImport() {
        if (!bundle) return
        const flowId = await importFlow(bundle, companyId, resolutions)
        if (flowId) {
            onImported(flowId)
            onOpenChange(false)
        }
    }

    const missingExtensions = preview
        ? preview.pendingExtensions.filter((p) => !resolutions.extensions[p.nodeId])
        : []
    const missingCredentials = preview
        ? preview.pendingCredentials.filter((p) => !resolutions.credentials[p.nodeId])
        : []
    const canImport = !!preview && missingExtensions.length === 0 && missingCredentials.length === 0

    const credentialsWithoutOptions = preview
        ? [...new Set(preview.pendingCredentials.map((p) => p.provider))].filter(
              (provider) => !preview.availableCredentials.some((c) => c.provider === provider)
          )
        : []

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!analyzing && !importing) onOpenChange(next)
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Importar flow</DialogTitle>
                    <DialogDescription>
                        Recria o flow do arquivo selecionado na empresa atual, junto com toda a
                        configuração dos recursos que ele referencia (fila, IVR, anúncio, etc).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    {fileName ? (
                        <div className="flex h-9 w-full items-center gap-1.5 rounded-md border px-2 text-sm">
                            <FileJsonIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{fileName}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={clearFile}
                                disabled={analyzing || importing}
                            >
                                <XIcon />
                                <span className="sr-only">Remover arquivo</span>
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadIcon />
                            Selecionar arquivo .json
                        </Button>
                    )}

                    {bundle && !preview && (
                        <Button onClick={handleAnalyze} disabled={analyzing}>
                            {analyzing ? "Analisando..." : "Analisar arquivo"}
                        </Button>
                    )}

                    {preview && (
                        <div className="flex flex-col gap-3">
                            {preview.pendingExtensions.length === 0 &&
                                preview.pendingCredentials.length === 0 && (
                                    <Alert>
                                        <AlertTitle>Pronto para importar</AlertTitle>
                                        <AlertDescription>
                                            Nenhum ramal ou credencial precisa ser escolhido - todo
                                            o resto é recriado automaticamente.
                                        </AlertDescription>
                                    </Alert>
                                )}

                            {preview.pendingExtensions.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium">
                                        Ramais usados pelo flow - escolha o ramal desta empresa
                                        que corresponde a cada um
                                    </p>
                                    {preview.pendingExtensions.map((p) => (
                                        <div key={p.nodeId} className="flex flex-col gap-1">
                                            <Label className="text-xs text-muted-foreground">
                                                {p.label ?? p.hint ?? "Ramal"}
                                                {p.hint && p.label ? ` (${p.hint})` : ""}
                                            </Label>
                                            <Select
                                                value={resolutions.extensions[p.nodeId] ?? ""}
                                                onValueChange={(value: string | null) =>
                                                    setResolutions((prev) => ({
                                                        ...prev,
                                                        extensions: { ...prev.extensions, [p.nodeId]: value ?? "" },
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione o ramal" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {preview.availableExtensions.map((ext) => (
                                                        <SelectItem key={ext.id} value={ext.id}>
                                                            {ext.alias} - {ext.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {preview.pendingCredentials.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium">
                                        Credenciais de integração - escolha a credencial já
                                        configurada nesta empresa
                                    </p>
                                    {credentialsWithoutOptions.length > 0 && (
                                        <Alert variant="destructive">
                                            <AlertTriangleIcon />
                                            <AlertTitle>Credencial não configurada</AlertTitle>
                                            <AlertDescription>
                                                Esta empresa ainda não tem nenhuma credencial do(s)
                                                provedor(es) {credentialsWithoutOptions.join(", ")}.{" "}
                                                <Link
                                                    to="/dashboard/integration-credentials"
                                                    className="underline"
                                                >
                                                    Configure uma antes de importar.
                                                </Link>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {preview.pendingCredentials.map((p) => (
                                        <div key={p.nodeId} className="flex flex-col gap-1">
                                            <Label className="text-xs text-muted-foreground">
                                                {p.label ?? "Nó IXC"} (sugestão: {p.nameHint})
                                            </Label>
                                            <Select
                                                value={resolutions.credentials[p.nodeId] ?? ""}
                                                onValueChange={(value: string | null) =>
                                                    setResolutions((prev) => ({
                                                        ...prev,
                                                        credentials: { ...prev.credentials, [p.nodeId]: value ?? "" },
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione a credencial" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {preview.availableCredentials
                                                        .filter((c) => c.provider === p.provider)
                                                        .map((c) => (
                                                            <SelectItem key={c.id} value={c.id}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                        Cancelar
                    </Button>
                    <Button onClick={handleImport} disabled={!canImport || importing}>
                        {importing ? "Importando..." : "Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
