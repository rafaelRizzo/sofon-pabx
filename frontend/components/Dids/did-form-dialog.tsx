"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { type Company } from "@/hooks/use-companies"
import {
    createDidSchema,
    updateDidSchema,
    type Did,
    type DidCreateForm,
    type DidStatus,
    type DidUpdateForm,
} from "@/hooks/use-dids"

const STATUS_OPTIONS: { value: DidStatus; label: string }[] = [
    { value: "active", label: "Ativo" },
    { value: "inactive", label: "Inativo" },
    { value: "blocked", label: "Bloqueado" },
]

type Props =
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          did: null
          companies: Company[]
          onCreate: (form: DidCreateForm) => Promise<boolean>
          onUpdate?: never
      }
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          did: Did
          companies: Company[]
          onCreate?: never
          onUpdate: (form: DidUpdateForm) => Promise<boolean>
      }

export function DidFormDialog({
    open,
    onOpenChange,
    did,
    companies,
    onCreate,
    onUpdate,
}: Props) {
    const isEdit = !!did

    const createForm = useForm<DidCreateForm>({
        resolver: zodResolver(createDidSchema),
        defaultValues: { number: "", companyId: "" },
    })

    const updateForm = useForm<DidUpdateForm>({
        resolver: zodResolver(updateDidSchema),
    })

    useEffect(() => {
        if (!open) return
        if (isEdit) {
            updateForm.reset({ number: did.number, status: did.status })
        } else {
            createForm.reset({ number: "", companyId: "" })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isEdit, did])

    const handleCreate = createForm.handleSubmit(async (form) => {
        const ok = await onCreate!(form)
        if (ok) onOpenChange(false)
    })

    const handleUpdate = updateForm.handleSubmit(async (form) => {
        const ok = await onUpdate!(form)
        if (ok) onOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar DID" : "Novo DID"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `Número ${did.number}`
                            : "Preencha os dados para criar o DID"}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="did-form"
                    onSubmit={isEdit ? handleUpdate : handleCreate}
                >
                    <FieldGroup>
                        {!isEdit && (
                            <Field>
                                <FieldLabel>Empresa</FieldLabel>
                                <Controller
                                    control={createForm.control}
                                    name="companyId"
                                    render={({ field }) => {
                                        const sel =
                                            companies.find(
                                                (c) => c.id === field.value
                                            ) ?? null
                                        return (
                                            <Combobox<Company>
                                                items={companies}
                                                value={sel}
                                                itemToStringLabel={(c) =>
                                                    c.name
                                                }
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                onValueChange={(company) =>
                                                    field.onChange(
                                                        company?.id ?? ""
                                                    )
                                                }
                                            >
                                                <ComboboxInput placeholder="Buscar empresa..." />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        Nenhuma empresa
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(company: Company) => (
                                                            <ComboboxItem
                                                                key={company.id}
                                                                value={company}
                                                            >
                                                                {company.name}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                        )
                                    }}
                                />
                                {createForm.formState.errors.companyId && (
                                    <FieldError>
                                        {
                                            createForm.formState.errors
                                                .companyId.message as string
                                        }
                                    </FieldError>
                                )}
                            </Field>
                        )}

                        <Field>
                            <FieldLabel>Número</FieldLabel>
                            <Input
                                placeholder="Ex: 5511999999999"
                                {...(isEdit
                                    ? updateForm.register("number")
                                    : createForm.register("number"))}
                            />
                            {isEdit
                                ? updateForm.formState.errors.number && (
                                      <FieldError>
                                          {
                                              updateForm.formState.errors.number
                                                  .message as string
                                          }
                                      </FieldError>
                                  )
                                : createForm.formState.errors.number && (
                                      <FieldError>
                                          {
                                              createForm.formState.errors.number
                                                  .message as string
                                          }
                                      </FieldError>
                                  )}
                        </Field>

                        {isEdit && (
                            <Field>
                                <FieldLabel>Status</FieldLabel>
                                <Controller
                                    control={updateForm.control}
                                    name="status"
                                    render={({ field }) => (
                                        <Select
                                            items={STATUS_OPTIONS}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map((s) => (
                                                    <SelectItem
                                                        key={s.value}
                                                        value={s.value}
                                                    >
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {updateForm.formState.errors.status && (
                                    <FieldError>
                                        {
                                            updateForm.formState.errors.status
                                                .message as string
                                        }
                                    </FieldError>
                                )}
                            </Field>
                        )}
                    </FieldGroup>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="did-form"
                        disabled={
                            isEdit
                                ? updateForm.formState.isSubmitting
                                : createForm.formState.isSubmitting
                        }
                    >
                        {isEdit
                            ? updateForm.formState.isSubmitting
                                ? "Salvando..."
                                : "Salvar"
                            : createForm.formState.isSubmitting
                              ? "Criando..."
                              : "Criar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
