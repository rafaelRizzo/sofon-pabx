"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

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
import {
    createVariableFormSchema,
    type Variable,
    type VariableForm,
} from "@/hooks/use-variable-catalog"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variable: Variable | null
    companies: Company[]
    defaultCompanyId?: string
    onSave: (form: VariableForm) => Promise<boolean>
}

export function VariableCatalogFormDialog({
    open,
    onOpenChange,
    variable,
    companies,
    defaultCompanyId,
    onSave,
}: Props) {
    const isEdit = !!variable

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<VariableForm>({
        resolver: zodResolver(createVariableFormSchema),
        defaultValues: { name: "", companyId: "", description: "" },
    })

    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: variable?.name ?? "",
            companyId: variable?.companyId ?? defaultCompanyId ?? "",
            description: variable?.description ?? "",
        })
    }, [open, variable, defaultCompanyId, reset])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar variável" : "Nova variável"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `Variável ${variable.name}`
                            : "Declare o nome de uma variável de canal pra usar em URAs, Definir Variável e outros módulos"}
                    </DialogDescription>
                </DialogHeader>

                <form id="variable-form" onSubmit={onSubmit}>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Nome</FieldLabel>
                            <Input
                                placeholder="Ex: CPF_CLIENTE"
                                maxLength={80}
                                {...register("name")}
                            />
                            {errors.name && (
                                <FieldError>{errors.name.message}</FieldError>
                            )}
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
                                        <ComboboxEmpty>
                                            Nenhuma empresa
                                        </ComboboxEmpty>
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
                                    <FieldError>
                                        {errors.companyId.message}
                                    </FieldError>
                                )}
                            </Field>
                        )}

                        <Field>
                            <FieldLabel>Descrição</FieldLabel>
                            <Input
                                placeholder="Ex: CPF ou CNPJ coletado na URA de atendimento"
                                maxLength={200}
                                {...register("description")}
                            />
                            {errors.description && (
                                <FieldError>
                                    {errors.description.message}
                                </FieldError>
                            )}
                            <FieldDescription>
                                Opcional - ajuda a lembrar pra que serve ao
                                selecionar essa variável em outro módulo.
                            </FieldDescription>
                        </Field>
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
                        form="variable-form"
                        disabled={isSubmitting}
                    >
                        {isEdit ? "Salvar" : "Criar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
