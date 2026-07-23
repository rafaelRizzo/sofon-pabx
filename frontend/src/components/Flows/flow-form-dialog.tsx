"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { type Company } from "@/hooks/use-companies"
import { type Flow } from "@/hooks/use-flows"

const flowNameFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
})
type FlowNameForm = z.infer<typeof flowNameFormSchema>

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    flow: Flow | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) — nesse caso
    // `flow` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: FlowNameForm) => Promise<boolean>
}

// Só nome + empresa — o destino/conexões de um Flow são montados no canvas (ver
// app/dashboard/flows/[id]/page.tsx), não num campo de formulário aqui.
export function FlowFormDialog({
    open,
    onOpenChange,
    flow,
    loading = false,
    companies,
    onSave,
}: Props) {
    const isEdit = !!flow

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<FlowNameForm>({
        resolver: zodResolver(flowNameFormSchema) as any,
        defaultValues: { name: "", companyId: "" },
    })

    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({ name: flow?.name ?? "", companyId: flow?.companyId ?? "" })
    }, [open, flow, reset])

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
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={2} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit ? "Renomear flow" : "Novo flow"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Flow ${flow.name}`
                                        : "Depois de criado, conecte os nós no canvas"}
                                </DialogDescription>
                            </DialogHeader>

                            <form id="flow-form" onSubmit={onSubmit}>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel>Nome</FieldLabel>
                                        <Input
                                            placeholder="Ex: atendimento-comercial"
                                            {...register("name")}
                                        />
                                        {errors.name && (
                                            <FieldError>
                                                {errors.name.message}
                                            </FieldError>
                                        )}
                                    </Field>

                                    {!isEdit && (
                                        <Field>
                                            <FieldLabel>Empresa</FieldLabel>
                                            <Combobox<Company>
                                                items={companies}
                                                value={selectedCompany}
                                                itemToStringLabel={(c) =>
                                                    c.name
                                                }
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                onValueChange={(c) =>
                                                    setValue(
                                                        "companyId",
                                                        c?.id ?? "",
                                                        {
                                                            shouldValidate: true,
                                                            shouldDirty: true,
                                                        }
                                                    )
                                                }
                                            >
                                                <ComboboxInput placeholder="Buscar empresa..." />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        Nenhuma empresa
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(c: Company) => (
                                                            <ComboboxItem
                                                                key={c.id}
                                                                value={c}
                                                            >
                                                                {c.name}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                            {errors.companyId && (
                                                <FieldError>
                                                    {errors.companyId.message}
                                                </FieldError>
                                            )}
                                        </Field>
                                    )}
                                </FieldGroup>
                            </form>

                            <DialogFooter className="pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => requestClose(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    form="flow-form"
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
                            {isEdit ? ` no flow "${flow.name}"` : " neste flow"}
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
