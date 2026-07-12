"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { FileAudioIcon, UploadIcon, XIcon } from "lucide-react"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { type Company } from "@/hooks/use-companies"
import { type Audio } from "@/hooks/use-audios"

const audioFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
})

type AudioFormValues = z.infer<typeof audioFormSchema>

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    audio: Audio | null
    companies: Company[]
    onSave: (form: AudioFormValues, file: File | null) => Promise<boolean>
}

const AUDIO_ACCEPT = "audio/*"

export function AudioFormDialog({ open, onOpenChange, audio, companies, onSave }: Props) {
    const isEdit = !!audio

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<AudioFormValues>({
        resolver: zodResolver(audioFormSchema),
        defaultValues: { name: "", companyId: "" },
    })

    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    const [file, setFile] = useState<File | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) return
        reset({ name: audio?.name ?? "", companyId: audio?.companyId ?? "" })
        setFile(null)
        setFileError(null)
    }, [open, audio, reset])

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = e.target.files?.[0] ?? null
        if (selected && !selected.type.startsWith("audio/")) {
            setFileError("O arquivo precisa ser um áudio")
            setFile(null)
            return
        }
        setFileError(null)
        setFile(selected)
    }

    const onSubmit = handleSubmit(async (form) => {
        if (!isEdit && !file) {
            setFileError("Selecione um arquivo de áudio")
            return
        }
        const ok = await onSave(form, file)
        if (ok) onOpenChange(false)
    })

    const hasChanges = isDirty || !!file

    // Fechar (X, Escape, clique fora, botão Cancelar) com alterações não salvas pede confirmação
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
    function requestClose(nextOpen: boolean) {
        if (!nextOpen && hasChanges) {
            setConfirmDiscardOpen(true)
            return
        }
        onOpenChange(nextOpen)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={requestClose}>
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "Renomear áudio" : "Enviar áudio"}</DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Áudio ${audio.name}`
                                : "Envie um arquivo de áudio para usar em anúncios, URAs e filas"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="audio-form"
                        onSubmit={onSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input placeholder="Ex: boas-vindas" {...register("name")} />
                                    {errors.name && <FieldError>{errors.name.message}</FieldError>}
                                </Field>

                                {!isEdit && (
                                    <Field>
                                        <FieldLabel>Empresa</FieldLabel>
                                        <Combobox<Company>
                                            items={companies}
                                            value={selectedCompany}
                                            itemToStringLabel={(c) => c.name}
                                            isItemEqualToValue={(a, b) => a.id === b.id}
                                            onValueChange={(c) =>
                                                setValue("companyId", c?.id ?? "", {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        >
                                            <ComboboxInput placeholder="Buscar empresa..." />
                                            <ComboboxContent>
                                                <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(c: Company) => (
                                                        <ComboboxItem key={c.id} value={c}>
                                                            {c.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                        {errors.companyId && (
                                            <FieldError>{errors.companyId.message}</FieldError>
                                        )}
                                    </Field>
                                )}

                                {!isEdit && (
                                    <Field>
                                        <FieldLabel>Arquivo</FieldLabel>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept={AUDIO_ACCEPT}
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        {file ? (
                                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                                <FileAudioIcon className="size-4 shrink-0 text-muted-foreground" />
                                                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    onClick={() => {
                                                        setFile(null)
                                                        if (fileInputRef.current) fileInputRef.current.value = ""
                                                    }}
                                                >
                                                    <XIcon />
                                                    <span className="sr-only">Remover arquivo</span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <UploadIcon />
                                                Selecionar arquivo
                                            </Button>
                                        )}
                                        {fileError && <FieldError>{fileError}</FieldError>}
                                        <FieldDescription>
                                            Convertido automaticamente para o formato usado pelo Asterisk
                                            (WAV PCM 16-bit mono 8kHz) — qualquer formato de áudio é aceito.
                                        </FieldDescription>
                                    </Field>
                                )}
                            </FieldGroup>
                        </div>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="audio-form" disabled={isSubmitting}>
                            {isSubmitting
                                ? isEdit
                                    ? "Salvando..."
                                    : "Enviando..."
                                : isEdit
                                  ? "Salvar"
                                  : "Enviar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit ? ` no áudio "${audio.name}"` : " neste envio"}. Se sair agora, elas
                            serão perdidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Continuar editando</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                setConfirmDiscardOpen(false)
                                onOpenChange(false)
                            }}
                        >
                            Descartar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
