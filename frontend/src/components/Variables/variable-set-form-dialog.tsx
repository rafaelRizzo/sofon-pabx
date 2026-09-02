"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { VariableCombobox } from "@/components/variable-combobox"
import { type Company } from "@/hooks/use-companies"
import {
    createVariableSetFormSchema,
    type VariableSet,
    type VariableSetForm,
} from "@/hooks/use-variables"

const emptyAssignment = { variable: "", value: "" }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variableSet: VariableSet | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `variableSet` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: VariableSetForm) => Promise<boolean>
    onDelete?: () => void
}

export function VariableSetFormDialog({
    open,
    onOpenChange,
    variableSet,
    loading = false,
    companies,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!variableSet
    const defaultCompanyId =
        companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<VariableSetForm>({
        resolver: zodResolver(createVariableSetFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            assignments: [emptyAssignment],
        },
    })

    const assignmentFields = useFieldArray({ control, name: "assignments" })

    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: variableSet?.name ?? "",
            companyId: variableSet?.companyId ?? defaultCompanyId,
            assignments: variableSet?.assignments?.length
                ? variableSet.assignments
                : [emptyAssignment],
        })
    }, [open, variableSet, reset, defaultCompanyId])

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
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-lg">
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={2} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit
                                        ? "Editar variável"
                                        : "Nova variável"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Variável ${variableSet.name}`
                                        : "Seta variáveis de canal (Set) e segue pro destino configurado"}
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                id="variable-set-form"
                                onSubmit={onSubmit}
                                className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                            >
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input
                                                placeholder="Ex: seta-crm-id"
                                                {...register("name")}
                                            />
                                            {errors.name && (
                                                <FieldError>
                                                    {errors.name.message}
                                                </FieldError>
                                            )}
                                        </Field>

                                        {!isEdit && !defaultCompanyId && (
                                            <Field>
                                                <FieldLabel>Empresa</FieldLabel>
                                                <Combobox<Company>
                                                    items={companies}
                                                    value={selectedCompany}
                                                    itemToStringLabel={(c) =>
                                                        c.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
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
                                                        {
                                                            errors.companyId
                                                                .message
                                                        }
                                                    </FieldError>
                                                )}
                                            </Field>
                                        )}

                                        <Field>
                                            <div className="flex items-center justify-between">
                                                <FieldLabel>
                                                    Atribuições
                                                </FieldLabel>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        assignmentFields.append(
                                                            emptyAssignment,
                                                            {
                                                                shouldFocus: false,
                                                            }
                                                        )
                                                    }
                                                >
                                                    <PlusIcon />
                                                    Adicionar
                                                </Button>
                                            </div>
                                            <FieldDescription>
                                                Variável de canal e valor a
                                                setar via <code>Set()</code>. O
                                                valor pode referenciar outra
                                                variável (ex:{" "}
                                                <code>
                                                    {"${CALLERID(num)}"}
                                                </code>
                                                ), resolvida pelo próprio
                                                Asterisk no momento da chamada.
                                            </FieldDescription>
                                            {errors.assignments?.root && (
                                                <FieldError>
                                                    {
                                                        errors.assignments.root
                                                            .message
                                                    }
                                                </FieldError>
                                            )}
                                            {assignmentFields.fields.length ===
                                            0 ? (
                                                <FieldDescription>
                                                    Nenhuma atribuição
                                                    configurada.
                                                </FieldDescription>
                                            ) : (
                                                <div className="space-y-2 rounded-md border p-2">
                                                    <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Variável
                                                        </span>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Valor
                                                        </span>
                                                        <span />
                                                    </div>
                                                    {assignmentFields.fields.map(
                                                        (field, index) => (
                                                            <div
                                                                key={field.id}
                                                                className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-2"
                                                            >
                                                                <div>
                                                                    <VariableCombobox
                                                                        companyId={
                                                                            companyId
                                                                        }
                                                                        value={
                                                                            watch(
                                                                                `assignments.${index}.variable`
                                                                            ) ??
                                                                            null
                                                                        }
                                                                        onChange={(
                                                                            name
                                                                        ) =>
                                                                            setValue(
                                                                                `assignments.${index}.variable`,
                                                                                name ??
                                                                                    "",
                                                                                {
                                                                                    shouldValidate:
                                                                                        true,
                                                                                    shouldDirty:
                                                                                        true,
                                                                                }
                                                                            )
                                                                        }
                                                                    />
                                                                    {errors
                                                                        .assignments?.[
                                                                        index
                                                                    ]
                                                                        ?.variable && (
                                                                        <FieldError>
                                                                            {
                                                                                errors
                                                                                    .assignments[
                                                                                    index
                                                                                ]
                                                                                    ?.variable
                                                                                    ?.message
                                                                            }
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Input
                                                                        placeholder="123"
                                                                        {...register(
                                                                            `assignments.${index}.value`
                                                                        )}
                                                                    />
                                                                    {errors
                                                                        .assignments?.[
                                                                        index
                                                                    ]
                                                                        ?.value && (
                                                                        <FieldError>
                                                                            {
                                                                                errors
                                                                                    .assignments[
                                                                                    index
                                                                                ]
                                                                                    ?.value
                                                                                    ?.message
                                                                            }
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        assignmentFields.remove(
                                                                            index
                                                                        )
                                                                    }
                                                                >
                                                                    <XIcon />
                                                                    <span className="sr-only">
                                                                        Remover
                                                                        atribuição
                                                                    </span>
                                                                </Button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
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
                                    form="variable-set-form"
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
                                ? ` na variável "${variableSet.name}"`
                                : " nesta variável"}
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
