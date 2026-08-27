"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    companyFormSchema,
    type Company,
    type CompanyForm,
    type CompanyStatus,
} from "@/hooks/use-companies"

const TIMEZONES = Intl.supportedValuesOf("timeZone")
const DEFAULT_TIMEZONE = "America/Sao_Paulo"

const STATUSES: { value: CompanyStatus; label: string }[] = [
    { value: "active", label: "Ativo" },
    { value: "inactive", label: "Inativo" },
    { value: "blocked", label: "Bloqueado" },
]

type CompanyFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    company: Company | null
    onSave: (form: CompanyForm) => Promise<boolean>
}

export function CompanyFormDialog({
    open,
    onOpenChange,
    company,
    onSave,
}: CompanyFormDialogProps) {
    const isEdit = !!company

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CompanyForm>({
        resolver: zodResolver(companyFormSchema),
        defaultValues: {
            name: "",
            doc: "",
            status: "active",
            timezone: DEFAULT_TIMEZONE,
            metadata: [],
            elevenLabsApiKey: "",
        },
    })

    const metadataFields = useFieldArray({ control, name: "metadata" })

    useEffect(() => {
        if (open) {
            reset({
                name: company?.name ?? "",
                doc: company?.doc ?? "",
                status: company?.status ?? "active",
                timezone: company?.timezone ?? DEFAULT_TIMEZONE,
                metadata: Object.entries(company?.metadata ?? {}).map(
                    ([key, value]) => ({ key, value: String(value) })
                ),
                elevenLabsApiKey: company?.elevenLabsApiKey ?? "",
            })
        }
    }, [open, company, reset])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar empresa" : "Nova empresa"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Altere os dados da empresa"
                            : "Preencha os dados para criar a empresa"}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={onSubmit}
                    className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]"
                >
                    <ScrollArea className="min-h-0">
                        <FieldGroup className="pr-3">
                            <Field>
                                <FieldLabel htmlFor="name">Nome</FieldLabel>
                                <Input
                                    id="name"
                                    placeholder="Nome da empresa"
                                    {...register("name")}
                                />
                                {errors.name && (
                                    <FieldError>
                                        {errors.name.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="doc">
                                    Documento (opcional)
                                </FieldLabel>
                                <Input
                                    id="doc"
                                    placeholder="CNPJ ou CPF"
                                    {...register("doc")}
                                />
                                {errors.doc && (
                                    <FieldError>
                                        {errors.doc.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel>Fuso horário</FieldLabel>
                                <Controller
                                    control={control}
                                    name="timezone"
                                    render={({ field }) => (
                                        <Combobox
                                            items={TIMEZONES}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <ComboboxInput placeholder="Buscar fuso horário..." />
                                            <ComboboxContent>
                                                <ComboboxEmpty>
                                                    Nenhum fuso encontrado
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(timezone: string) => (
                                                        <ComboboxItem
                                                            key={timezone}
                                                            value={timezone}
                                                        >
                                                            {timezone}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    )}
                                />
                                {errors.timezone && (
                                    <FieldError>
                                        {errors.timezone.message}
                                    </FieldError>
                                )}
                            </Field>
                            {isEdit && (
                                <Field>
                                    <FieldLabel>Status</FieldLabel>
                                    <Controller
                                        control={control}
                                        name="status"
                                        render={({ field }) => (
                                            <Select
                                                items={STATUSES}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUSES.map((status) => (
                                                        <SelectItem
                                                            key={status.value}
                                                            value={status.value}
                                                        >
                                                            {status.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.status && (
                                        <FieldError>
                                            {errors.status.message}
                                        </FieldError>
                                    )}
                                </Field>
                            )}
                            <Field>
                                <FieldLabel htmlFor="elevenLabsApiKey">
                                    ElevenLabs API Key (opcional)
                                </FieldLabel>
                                <Input
                                    id="elevenLabsApiKey"
                                    type="password"
                                    placeholder="Cole a API key da conta ElevenLabs da empresa"
                                    autoComplete="off"
                                    {...register("elevenLabsApiKey")}
                                />
                                {errors.elevenLabsApiKey && (
                                    <FieldError>
                                        {errors.elevenLabsApiKey.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel>
                                        Campos adicionais (opcional)
                                    </FieldLabel>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            metadataFields.append({
                                                key: "",
                                                value: "",
                                            })
                                        }
                                    >
                                        <PlusIcon />
                                        Adicionar
                                    </Button>
                                </div>
                                {metadataFields.fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2">
                                        <div className="flex-1">
                                            <Input
                                                placeholder="Chave"
                                                {...register(
                                                    `metadata.${index}.key`
                                                )}
                                            />
                                            {errors.metadata?.[index]?.key && (
                                                <FieldError>
                                                    {
                                                        errors.metadata[index]
                                                            .key.message
                                                    }
                                                </FieldError>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                placeholder="Valor"
                                                {...register(
                                                    `metadata.${index}.value`
                                                )}
                                            />
                                            {errors.metadata?.[index]
                                                ?.value && (
                                                <FieldError>
                                                    {
                                                        errors.metadata[index]
                                                            .value.message
                                                    }
                                                </FieldError>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                                metadataFields.remove(index)
                                            }
                                        >
                                            <XIcon />
                                            <span className="sr-only">
                                                Remover campo
                                            </span>
                                        </Button>
                                    </div>
                                ))}
                            </Field>
                        </FieldGroup>
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
