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
import { NumberInput } from "@/components/ui/number-input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { RouteDestinationField } from "@/components/RouteDestination/route-destination-field"
import { type Company } from "@/hooks/use-companies"
import {
    createRequestTemplateFormSchema,
    HTTP_METHODS,
    type HttpMethod,
    type RequestTemplate,
    type RequestTemplateForm,
} from "@/hooks/use-request-templates"

const HTTP_METHOD_ITEMS = HTTP_METHODS.map((m) => ({ value: m, label: m }))

const emptyHeader = { key: "", value: "" }
const emptyVariableMapping = { path: "", variable: "" }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    requestTemplate: RequestTemplate | null
    companies: Company[]
    onSave: (form: RequestTemplateForm) => Promise<boolean>
}

export function RequestTemplateFormDialog({
    open,
    onOpenChange,
    requestTemplate,
    companies,
    onSave,
}: Props) {
    const isEdit = !!requestTemplate

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<RequestTemplateForm>({
        resolver: zodResolver(createRequestTemplateFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: "",
            method: "GET",
            url: "",
            timeoutMs: 5000,
            headers: [],
            body: "",
            variableMappings: [],
            onSuccess: { type: "hangup" },
            onError: { type: "hangup" },
        },
    })

    const headerFields = useFieldArray({ control, name: "headers" })
    const variableMappingFields = useFieldArray({ control, name: "variableMappings" })

    const companyId = watch("companyId")
    const method = watch("method")
    const onSuccess = watch("onSuccess")
    const onError = watch("onError")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: requestTemplate?.name ?? "",
            companyId: requestTemplate?.companyId ?? "",
            method: requestTemplate?.method ?? "GET",
            url: requestTemplate?.url ?? "",
            timeoutMs: requestTemplate?.timeoutMs ?? 5000,
            headers: requestTemplate?.headers
                ? Object.entries(requestTemplate.headers).map(([key, value]) => ({ key, value }))
                : [],
            body: requestTemplate?.body ? JSON.stringify(requestTemplate.body, null, 2) : "",
            variableMappings: requestTemplate?.variableMappings ?? [],
            onSuccess: requestTemplate?.onSuccess ?? { type: "hangup" },
            onError: requestTemplate?.onError ?? { type: "hangup" },
        })
    }, [open, requestTemplate, reset])

    // Ao trocar de empresa na criação, os destinos escolhidos pra empresa anterior não fazem mais
    // sentido (IDs de outra empresa) — reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, { shouldValidate: true, shouldDirty: true })
        setValue("onSuccess", { type: "hangup" }, { shouldDirty: true })
        setValue("onError", { type: "hangup" }, { shouldDirty: true })
    }

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    const hasRequestErrors = !!(errors.method || errors.url || errors.timeoutMs || errors.headers || errors.body)
    const hasVariableErrors = !!errors.variableMappings
    const hasRoutingErrors = !!(errors.onSuccess || errors.onError)

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
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Editar template de requisição" : "Novo template de requisição"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Template ${requestTemplate.name}`
                                : "Dispara uma requisição HTTP durante a chamada, via AGI"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="request-template-form"
                        onSubmit={onSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input placeholder="Ex: consulta-cliente" {...register("name")} />
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
                                            onValueChange={(c) => handleCompanyChange(c?.id ?? "")}
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

                                <Tabs defaultValue="request" className="w-full">
                                    <TabsList className="w-full">
                                        <TabsTrigger value="request" className="flex-1">
                                            Requisição
                                            {hasRequestErrors && (
                                                <span className="size-1.5 rounded-full bg-destructive" />
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger value="variables" className="flex-1">
                                            Variáveis
                                            {hasVariableErrors && (
                                                <span className="size-1.5 rounded-full bg-destructive" />
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger value="routing" className="flex-1">
                                            Roteamento
                                            {hasRoutingErrors && (
                                                <span className="size-1.5 rounded-full bg-destructive" />
                                            )}
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="request">
                                        <FieldGroup>
                                            <div className="grid grid-cols-[7rem_1fr] gap-3">
                                                <Field>
                                                    <FieldLabel>Método</FieldLabel>
                                                    <Select
                                                        items={HTTP_METHOD_ITEMS}
                                                        value={method}
                                                        onValueChange={(v) =>
                                                            setValue("method", v as HttpMethod, {
                                                                shouldDirty: true,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Método" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {HTTP_METHODS.map((m) => (
                                                                <SelectItem key={m} value={m}>
                                                                    {m}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </Field>
                                                <Field>
                                                    <FieldLabel>URL</FieldLabel>
                                                    <Input
                                                        placeholder="https://api.exemplo.com/clientes/{{CALLERID}}"
                                                        {...register("url")}
                                                    />
                                                    {errors.url && <FieldError>{errors.url.message}</FieldError>}
                                                </Field>
                                            </div>
                                            <FieldDescription className="-mt-2">
                                                Suporta placeholders <code>{"{{VAR}}"}</code> resolvidos via variável
                                                de canal no momento da chamada.
                                            </FieldDescription>

                                            <Field className="max-w-28">
                                                <FieldLabel>Timeout (ms)</FieldLabel>
                                                <NumberInput
                                                    min={500}
                                                    max={30000}
                                                    step={500}
                                                    {...register("timeoutMs")}
                                                />
                                                {errors.timeoutMs && (
                                                    <FieldError>{errors.timeoutMs.message}</FieldError>
                                                )}
                                            </Field>

                                            <Field>
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel>Headers HTTP</FieldLabel>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            headerFields.append(emptyHeader, { shouldFocus: false })
                                                        }
                                                    >
                                                        <PlusIcon />
                                                        Adicionar
                                                    </Button>
                                                </div>
                                                {headerFields.fields.length === 0 ? (
                                                    <FieldDescription>Nenhum header configurado.</FieldDescription>
                                                ) : (
                                                    <div className="space-y-2 rounded-md border p-2">
                                                        {headerFields.fields.map((field, index) => (
                                                            <div
                                                                key={field.id}
                                                                className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-2"
                                                            >
                                                                <div>
                                                                    <Input
                                                                        placeholder="Authorization"
                                                                        {...register(`headers.${index}.key`)}
                                                                    />
                                                                    {errors.headers?.[index]?.key && (
                                                                        <FieldError>
                                                                            {errors.headers[index]?.key?.message}
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Input
                                                                        placeholder="Bearer {{TOKEN}}"
                                                                        {...register(`headers.${index}.value`)}
                                                                    />
                                                                    {errors.headers?.[index]?.value && (
                                                                        <FieldError>
                                                                            {errors.headers[index]?.value?.message}
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => headerFields.remove(index)}
                                                                >
                                                                    <XIcon />
                                                                    <span className="sr-only">Remover header</span>
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </Field>

                                            <Field>
                                                <FieldLabel>Corpo da requisição (JSON)</FieldLabel>
                                                <Textarea
                                                    rows={5}
                                                    placeholder={'{\n  "campo": "{{VAR}}"\n}'}
                                                    className="font-mono"
                                                    {...register("body")}
                                                />
                                                <FieldDescription>
                                                    Opcional. Precisa ser um JSON válido; suporta{" "}
                                                    <code>{"{{VAR}}"}</code> nos valores.
                                                </FieldDescription>
                                                {errors.body && <FieldError>{errors.body.message}</FieldError>}
                                            </Field>
                                        </FieldGroup>
                                    </TabsContent>

                                    <TabsContent value="variables">
                                        <FieldGroup>
                                            <Field>
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel>Mapeamento de variáveis</FieldLabel>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            variableMappingFields.append(emptyVariableMapping, {
                                                                shouldFocus: false,
                                                            })
                                                        }
                                                    >
                                                        <PlusIcon />
                                                        Adicionar
                                                    </Button>
                                                </div>
                                                <FieldDescription>
                                                    Extrai um valor da resposta JSON (ex: <code>data.client[0].id</code>)
                                                    e grava numa variável de canal, disponível no dialplan após o
                                                    request.
                                                </FieldDescription>
                                                {errors.variableMappings?.root && (
                                                    <FieldError>{errors.variableMappings.root.message}</FieldError>
                                                )}
                                                {variableMappingFields.fields.length === 0 ? (
                                                    <FieldDescription>
                                                        Nenhum mapeamento configurado.
                                                    </FieldDescription>
                                                ) : (
                                                    <div className="space-y-2 rounded-md border p-2">
                                                        <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-2">
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                Caminho JSON
                                                            </span>
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                Variável
                                                            </span>
                                                            <span />
                                                        </div>
                                                        {variableMappingFields.fields.map((field, index) => (
                                                            <div
                                                                key={field.id}
                                                                className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-2"
                                                            >
                                                                <div>
                                                                    <Input
                                                                        placeholder="data.client[0].id"
                                                                        {...register(
                                                                            `variableMappings.${index}.path`
                                                                        )}
                                                                    />
                                                                    {errors.variableMappings?.[index]?.path && (
                                                                        <FieldError>
                                                                            {
                                                                                errors.variableMappings[index]?.path
                                                                                    ?.message
                                                                            }
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Input
                                                                        placeholder="CLIENT_ID"
                                                                        {...register(
                                                                            `variableMappings.${index}.variable`
                                                                        )}
                                                                    />
                                                                    {errors.variableMappings?.[index]?.variable && (
                                                                        <FieldError>
                                                                            {
                                                                                errors.variableMappings[index]
                                                                                    ?.variable?.message
                                                                            }
                                                                        </FieldError>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        variableMappingFields.remove(index)
                                                                    }
                                                                >
                                                                    <XIcon />
                                                                    <span className="sr-only">
                                                                        Remover mapeamento
                                                                    </span>
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </Field>
                                        </FieldGroup>
                                    </TabsContent>

                                    <TabsContent value="routing">
                                        <FieldGroup>
                                            <Field>
                                                <FieldLabel>Destino em caso de sucesso</FieldLabel>
                                                <RouteDestinationField
                                                    value={onSuccess}
                                                    onChange={(d) =>
                                                        setValue("onSuccess", d, {
                                                            shouldValidate: true,
                                                            shouldDirty: true,
                                                        })
                                                    }
                                                    companyId={companyId}
                                                />
                                                <FieldDescription>
                                                    Para onde a chamada é direcionada após a requisição responder com
                                                    sucesso.
                                                </FieldDescription>
                                            </Field>

                                            <Field>
                                                <FieldLabel>Destino em caso de erro</FieldLabel>
                                                <RouteDestinationField
                                                    value={onError}
                                                    onChange={(d) =>
                                                        setValue("onError", d, {
                                                            shouldValidate: true,
                                                            shouldDirty: true,
                                                        })
                                                    }
                                                    companyId={companyId}
                                                />
                                                <FieldDescription>
                                                    Para onde a chamada é direcionada se a requisição falhar ou
                                                    estourar o timeout.
                                                </FieldDescription>
                                            </Field>
                                        </FieldGroup>
                                    </TabsContent>
                                </Tabs>
                            </FieldGroup>
                        </div>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="request-template-form" disabled={isSubmitting}>
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

            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit ? ` no template "${requestTemplate.name}"` : " neste template"}. Se sair
                            agora, elas serão perdidas.
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
