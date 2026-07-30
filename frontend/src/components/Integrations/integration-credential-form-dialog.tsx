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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
    createIntegrationCredentialFormSchema,
    updateIntegrationCredentialFormSchema,
    INTEGRATION_PROVIDERS,
    INTEGRATION_PROVIDER_LABELS,
    type IntegrationCredential,
    type IntegrationCredentialForm,
    type IntegrationProvider,
} from "@/hooks/use-integration-credentials"

const PROVIDER_ITEMS = INTEGRATION_PROVIDERS.map((p) => ({ value: p, label: INTEGRATION_PROVIDER_LABELS[p] }))

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    integrationCredential: IntegrationCredential | null
    companies: Company[]
    onSave: (form: IntegrationCredentialForm) => Promise<boolean>
    onDelete?: () => void
}

export function IntegrationCredentialFormDialog({ open, onOpenChange, integrationCredential, companies, onSave, onDelete }: Props) {
    const isEdit = !!integrationCredential
    const defaultCompanyId = companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<IntegrationCredentialForm>({
        resolver: zodResolver(isEdit ? updateIntegrationCredentialFormSchema : createIntegrationCredentialFormSchema) as any,
        defaultValues: { provider: "ixc", name: "", companyId: defaultCompanyId, baseUrl: "", token: "" },
    })

    const companyId = watch("companyId")
    const provider = watch("provider")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            provider: integrationCredential?.provider ?? "ixc",
            name: integrationCredential?.name ?? "",
            companyId: integrationCredential?.companyId ?? defaultCompanyId,
            baseUrl: integrationCredential?.baseUrl ?? "",
            token: "",
        })
    }, [open, integrationCredential, reset, defaultCompanyId])

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
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "Editar credencial" : "Nova credencial de integração"}</DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Credencial ${integrationCredential.name}`
                                : "Base URL e token de acesso à API de um provedor, reutilizáveis por vários nós de flow"}
                        </DialogDescription>
                    </DialogHeader>

                    <form id="integration-credential-form" onSubmit={onSubmit}>
                        <FieldGroup>
                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Provedor</FieldLabel>
                                    <Select
                                        items={PROVIDER_ITEMS}
                                        value={provider}
                                        onValueChange={(v) =>
                                            setValue("provider", v as IntegrationProvider, { shouldDirty: true })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Provedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INTEGRATION_PROVIDERS.map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {INTEGRATION_PROVIDER_LABELS[p]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}

                            <Field>
                                <FieldLabel>Nome</FieldLabel>
                                <Input placeholder="Ex: IXC - Matriz" {...register("name")} />
                                {errors.name && <FieldError>{errors.name.message}</FieldError>}
                            </Field>

                            {!isEdit && !defaultCompanyId && (
                                <Field>
                                    <FieldLabel>Empresa</FieldLabel>
                                    <Combobox<Company>
                                        items={companies}
                                        value={selectedCompany}
                                        itemToStringLabel={(c) => c.name}
                                        isItemEqualToValue={(a, b) => a.id === b.id}
                                        onValueChange={(c) =>
                                            setValue("companyId", c?.id ?? "", { shouldValidate: true, shouldDirty: true })
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
                                    {errors.companyId && <FieldError>{errors.companyId.message}</FieldError>}
                                </Field>
                            )}

                            <Field>
                                <FieldLabel>Base URL</FieldLabel>
                                <Input placeholder="https://seudominio.ixcsoft.com.br" {...register("baseUrl")} />
                                {errors.baseUrl && <FieldError>{errors.baseUrl.message}</FieldError>}
                            </Field>

                            <Field>
                                <FieldLabel>Token</FieldLabel>
                                <Input type="password" placeholder={isEdit ? "Deixe em branco para manter o atual" : ""} {...register("token")} />
                                {errors.token && <FieldError>{errors.token.message}</FieldError>}
                                <FieldDescription>
                                    Gerado no painel do provedor. Nunca é exibido novamente após salvo — para trocar, informe um novo.
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>

                    <DialogFooter className="pt-4">
                        {isEdit && onDelete && (
                            <Button type="button" variant="destructive" className="mr-auto" onClick={onDelete}>
                                Excluir
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="integration-credential-form" disabled={isSubmitting}>
                            {isSubmitting ? (isEdit ? "Salvando..." : "Criando...") : isEdit ? "Salvar" : "Criar"}
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
                            {isEdit ? ` na credencial "${integrationCredential.name}"` : " nesta credencial"}. Se sair agora, elas serão perdidas.
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
