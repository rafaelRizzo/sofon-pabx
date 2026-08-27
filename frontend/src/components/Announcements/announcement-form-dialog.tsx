"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

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
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Audio, useAudios } from "@/hooks/use-audios"
import {
    createAnnouncementFormSchema,
    type Announcement,
    type AnnouncementForm,
} from "@/hooks/use-announcements"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    announcement: Announcement | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) — nesse caso
    // `announcement` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companyId: string
    onSave: (form: AnnouncementForm) => Promise<boolean>
    onDelete?: () => void
}

export function AnnouncementFormDialog({
    open,
    onOpenChange,
    announcement,
    loading = false,
    companyId,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!announcement

    const { audios } = useAudios(companyId)

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<AnnouncementForm>({
        resolver: zodResolver(createAnnouncementFormSchema) as any,
        defaultValues: {
            name: "",
            audioId: null,
        },
    })

    const audioId = watch("audioId")

    useEffect(() => {
        if (!open) return
        reset({
            name: announcement?.name ?? "",
            audioId: announcement?.audioId ?? null,
        })
    }, [open, announcement, reset])

    const selectedAudio = audios.find((a) => a.id === audioId) ?? null

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    // Fechar (X, Escape, clique fora, botão Cancelar) com alterações não salvas pede confirmação
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
    function requestClose(nextOpen: boolean) {
        if (!nextOpen && isDirty) {
            setConfirmDiscardOpen(true)
            return
        }
        onOpenChange(nextOpen)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={requestClose}>
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={2} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit ? "Editar anúncio" : "Novo anúncio"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Anúncio ${announcement.name}`
                                        : "Preencha os dados para criar o anúncio"}
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                id="announcement-form"
                                onSubmit={onSubmit}
                                className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                            >
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input
                                                placeholder="Ex: aviso-manutencao"
                                                {...register("name")}
                                            />
                                            {errors.name && (
                                                <FieldError>
                                                    {errors.name.message}
                                                </FieldError>
                                            )}
                                        </Field>

                                        <Field>
                                            <FieldLabel>Áudio</FieldLabel>
                                            <Combobox<Audio>
                                                items={audios}
                                                value={selectedAudio}
                                                itemToStringLabel={(a) =>
                                                    a.name
                                                }
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                onValueChange={(a) =>
                                                    setValue(
                                                        "audioId",
                                                        a?.id ?? null,
                                                        { shouldDirty: true }
                                                    )
                                                }
                                            >
                                                <ComboboxInput placeholder="Buscar áudio..." />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        Nenhum áudio cadastrado
                                                        para essa empresa
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(a: Audio) => (
                                                            <ComboboxItem
                                                                key={a.id}
                                                                value={a}
                                                            >
                                                                {a.name}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                            <FieldDescription>
                                                Sem áudio vinculado, o anúncio
                                                não pode ser usado como destino
                                                em outras rotas até um ser
                                                enviado (em Áudios) e
                                                selecionado aqui.
                                            </FieldDescription>
                                        </Field>
                                    </FieldGroup>
                                </ScrollArea>
                            </form>

                            <DialogFooter className="pt-4">
                                {isEdit && onDelete && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="mr-auto"
                                        onClick={onDelete}
                                    >
                                        Excluir recurso
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => requestClose(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    form="announcement-form"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting
                                        ? isEdit
                                            ? "Salvando..."
                                            : "Criando..."
                                        : isEdit
                                          ? "Salvar"
                                          : "Criar"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={confirmDiscardOpen}
                onOpenChange={setConfirmDiscardOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Descartar alterações?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit
                                ? ` no anúncio "${announcement.name}"`
                                : " neste anúncio"}
                            . Se sair agora, elas serão perdidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Continuar editando
                        </AlertDialogCancel>
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
