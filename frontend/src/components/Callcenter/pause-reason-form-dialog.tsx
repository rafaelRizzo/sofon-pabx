"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    pauseReasonFormSchema,
    type PauseReasonForm,
} from "@/hooks/use-pause-reasons"
import { type PauseReasonFormDialogProps } from "@/components/Callcenter/types"

export function PauseReasonFormDialog({
    open,
    onOpenChange,
    pauseReason,
    companyId,
    onSave,
}: PauseReasonFormDialogProps) {
    const isEdit = !!pauseReason

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<PauseReasonForm>({
        resolver: zodResolver(pauseReasonFormSchema) as any,
        defaultValues: { companyId, label: "", active: true },
    })

    useEffect(() => {
        if (!open) return
        reset({
            companyId,
            label: pauseReason?.label ?? "",
            active: pauseReason?.active ?? true,
        })
    }, [open, pauseReason, companyId, reset])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Editar motivo de pausa" : "Novo motivo de pausa"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Motivo "${pauseReason.label}"`
                                : "Disponível pro agente escolher ao se pausar no Painel do Agente"}
                        </DialogDescription>
                    </DialogHeader>

                    <form id="pause-reason-form" onSubmit={onSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel>Motivo</FieldLabel>
                                <Input
                                    placeholder="Ex: Almoço"
                                    {...register("label")}
                                />
                                {errors.label && (
                                    <FieldError>{errors.label.message}</FieldError>
                                )}
                            </Field>

                            <Field orientation="horizontal">
                                <Controller
                                    control={control}
                                    name="active"
                                    render={({ field }) => (
                                        <Switch
                                            id="active"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                                <FieldLabel htmlFor="active">Motivo ativo</FieldLabel>
                            </Field>
                        </FieldGroup>
                    </form>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => requestClose(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form="pause-reason-form"
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
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={confirmDiscardOpen}
                onOpenChange={setConfirmDiscardOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit ? ` no motivo "${pauseReason.label}"` : " neste motivo"}
                            . Se sair agora, elas serão perdidas.
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
