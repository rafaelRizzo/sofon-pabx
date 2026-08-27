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
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { VariableInsertField } from "@/components/variable-insert-field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Company } from "@/hooks/use-companies"
import { useIntegrationCredentials } from "@/hooks/use-integration-credentials"
import {
    createIxcNodeFormSchema,
    IXC_NODE_ACTIONS,
    IXC_NODE_ACTION_LABELS,
    type IxcNode,
    type IxcNodeAction,
    type IxcNodeForm,
} from "@/hooks/use-ixc-nodes"

const IXC_NODE_ACTION_ITEMS = IXC_NODE_ACTIONS.map((a) => ({
    value: a,
    label: IXC_NODE_ACTION_LABELS[a],
}))

const emptyParam = { key: "", value: "" }
const emptyVariableMapping = { path: "", variable: "" }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    ixcNode: IxcNode | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) — nesse caso
    // `ixcNode` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: IxcNodeForm) => Promise<boolean>
    onDelete?: () => void
}

export function IxcNodeFormDialog({
    open,
    onOpenChange,
    ixcNode,
    loading = false,
    companies,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!ixcNode
    const defaultCompanyId = companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        getValues,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<IxcNodeForm>({
        resolver: zodResolver(createIxcNodeFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            credentialId: "",
            action: "listar_cliente",
            timeoutMs: 5000,
            params: [],
            variableMappings: [],
        },
    })

    const paramFields = useFieldArray({ control, name: "params" })
    const variableMappingFields = useFieldArray({ control, name: "variableMappings" })

    const companyId = watch("companyId")
    const credentialId = watch("credentialId")
    const action = watch("action")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    const { integrationCredentials } = useIntegrationCredentials(companyId, "ixc")
    const credentialItems = integrationCredentials.map((c) => ({ value: c.id, label: c.name }))

    useEffect(() => {
        if (!open) return
        reset({
            name: ixcNode?.name ?? "",
            companyId: ixcNode?.companyId ?? defaultCompanyId,
            credentialId: ixcNode?.credentialId ?? "",
            action: ixcNode?.action ?? "listar_cliente",
            timeoutMs: ixcNode?.timeoutMs ?? 5000,
            params: ixcNode?.params
                ? Object.entries(ixcNode.params).map(([key, value]) => ({ key, value }))
                : [],
            variableMappings: ixcNode?.variableMappings ?? [],
        })
    }, [open, ixcNode, reset, defaultCompanyId])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    const hasIxcErrors = !!(errors.credentialId || errors.action || errors.timeoutMs || errors.params)
    const hasVariableErrors = !!errors.variableMappings

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
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={4} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>{isEdit ? "Editar nó IXCsoft" : "Novo nó IXCsoft"}</DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Nó ${ixcNode.name}`
                                        : "Executa uma ação pré-configurada no IXCsoft durante a chamada, via AGI"}
                                </DialogDescription>
                            </DialogHeader>

                            <form id="ixc-node-form" onSubmit={onSubmit} className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]">
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input placeholder="Ex: consulta-cliente-cpf" {...register("name")} />
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
                                                {errors.companyId && <FieldError>{errors.companyId.message}</FieldError>}
                                            </Field>
                                        )}

                                        <Tabs defaultValue="ixc" className="w-full">
                                            <TabsList className="w-full">
                                                <TabsTrigger value="ixc" className="flex-1">
                                                    IXCsoft
                                                    {hasIxcErrors && <span className="size-1.5 rounded-full bg-destructive" />}
                                                </TabsTrigger>
                                                <TabsTrigger value="variables" className="flex-1">
                                                    Variáveis
                                                    {hasVariableErrors && <span className="size-1.5 rounded-full bg-destructive" />}
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="ixc">
                                                <FieldGroup>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <FieldLabel>Credencial</FieldLabel>
                                                            <Select
                                                                items={credentialItems}
                                                                value={credentialId}
                                                                onValueChange={(v) =>
                                                                    setValue("credentialId", v ?? "", { shouldDirty: true, shouldValidate: true })
                                                                }
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Selecione a credencial" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {credentialItems.length === 0 ? (
                                                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                                            Nenhuma credencial cadastrada
                                                                        </div>
                                                                    ) : (
                                                                        credentialItems.map((item) => (
                                                                            <SelectItem key={item.value} value={item.value}>
                                                                                {item.label}
                                                                            </SelectItem>
                                                                        ))
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                            {errors.credentialId && <FieldError>{errors.credentialId.message}</FieldError>}
                                                            <FieldDescription>
                                                                Cadastradas em Automação &gt; Credenciais de integração (provedor IXCsoft).
                                                            </FieldDescription>
                                                        </Field>

                                                        <Field>
                                                            <FieldLabel>Ação</FieldLabel>
                                                            <Select
                                                                items={IXC_NODE_ACTION_ITEMS}
                                                                value={action}
                                                                onValueChange={(v) =>
                                                                    setValue("action", v as IxcNodeAction, { shouldDirty: true })
                                                                }
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Ação" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {IXC_NODE_ACTIONS.map((a) => (
                                                                        <SelectItem key={a} value={a}>
                                                                            {IXC_NODE_ACTION_LABELS[a]}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </Field>
                                                    </div>

                                                    <Field className="max-w-28">
                                                        <FieldLabel>Timeout (ms)</FieldLabel>
                                                        <NumberInput min={500} max={30000} step={500} {...register("timeoutMs")} />
                                                        {errors.timeoutMs && <FieldError>{errors.timeoutMs.message}</FieldError>}
                                                    </Field>

                                                    <Field>
                                                        <div className="flex items-center justify-between">
                                                            <FieldLabel>Parâmetros</FieldLabel>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => paramFields.append(emptyParam, { shouldFocus: false })}
                                                            >
                                                                <PlusIcon />
                                                                Adicionar
                                                            </Button>
                                                        </div>
                                                        <FieldDescription>
                                                            Suporta placeholders <code>{"{{VAR}}"}</code> resolvidos via variável de canal
                                                            no momento da chamada (ex: <code>query</code>: <code>{"{{CALLERID(num)}}"}</code>).
                                                        </FieldDescription>
                                                        {paramFields.fields.length === 0 ? (
                                                            <FieldDescription>Nenhum parâmetro configurado.</FieldDescription>
                                                        ) : (
                                                            <div className="space-y-2 rounded-md border p-2">
                                                                {paramFields.fields.map((field, index) => (
                                                                    <div
                                                                        key={field.id}
                                                                        className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-2"
                                                                    >
                                                                        <div>
                                                                            <Input
                                                                                placeholder="query"
                                                                                {...register(`params.${index}.key`)}
                                                                            />
                                                                            {errors.params?.[index]?.key && (
                                                                                <FieldError>{errors.params[index]?.key?.message}</FieldError>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <VariableInsertField
                                                                                name={`params.${index}.value`}
                                                                                register={register}
                                                                                setValue={setValue}
                                                                                getValues={getValues}
                                                                                placeholder="{{CALLERID(num)}}"
                                                                                className="min-w-0"
                                                                            />
                                                                            {errors.params?.[index]?.value && (
                                                                                <FieldError>{errors.params[index]?.value?.message}</FieldError>
                                                                            )}
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => paramFields.remove(index)}
                                                                        >
                                                                            <XIcon />
                                                                            <span className="sr-only">Remover parâmetro</span>
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
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
                                                                    variableMappingFields.append(emptyVariableMapping, { shouldFocus: false })
                                                                }
                                                            >
                                                                <PlusIcon />
                                                                Adicionar
                                                            </Button>
                                                        </div>
                                                        <FieldDescription>
                                                            Extrai um valor da resposta JSON (ex: <code>cliente[0].id</code>) e grava numa
                                                            variável de canal, disponível no dialplan após a ação.
                                                        </FieldDescription>
                                                        {errors.variableMappings?.root && (
                                                            <FieldError>{errors.variableMappings.root.message}</FieldError>
                                                        )}
                                                        {variableMappingFields.fields.length === 0 ? (
                                                            <FieldDescription>Nenhum mapeamento configurado.</FieldDescription>
                                                        ) : (
                                                            <div className="space-y-2 rounded-md border p-2">
                                                                <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-2">
                                                                    <span className="px-3 text-xs font-medium text-muted-foreground">
                                                                        Caminho JSON
                                                                    </span>
                                                                    <span className="px-3 text-xs font-medium text-muted-foreground">
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
                                                                                placeholder="cliente[0].id"
                                                                                {...register(`variableMappings.${index}.path`)}
                                                                            />
                                                                            {errors.variableMappings?.[index]?.path && (
                                                                                <FieldError>
                                                                                    {errors.variableMappings[index]?.path?.message}
                                                                                </FieldError>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Input
                                                                                placeholder="CLIENT_ID"
                                                                                {...register(`variableMappings.${index}.variable`)}
                                                                            />
                                                                            {errors.variableMappings?.[index]?.variable && (
                                                                                <FieldError>
                                                                                    {errors.variableMappings[index]?.variable?.message}
                                                                                </FieldError>
                                                                            )}
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => variableMappingFields.remove(index)}
                                                                        >
                                                                            <XIcon />
                                                                            <span className="sr-only">Remover mapeamento</span>
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </Field>
                                                </FieldGroup>
                                            </TabsContent>
                                        </Tabs>
                                    </FieldGroup>
                                </ScrollArea>
                            </form>

                            <DialogFooter className="pt-4">
                                {isEdit && onDelete && (
                                    <Button type="button" variant="destructive" className="mr-auto" onClick={onDelete}>
                                        Excluir recurso
                                    </Button>
                                )}
                                <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" form="ixc-node-form" disabled={isSubmitting}>
                                    {isSubmitting ? (isEdit ? "Salvando..." : "Criando...") : isEdit ? "Salvar" : "Criar"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit ? ` no nó "${ixcNode.name}"` : " neste nó"}. Se sair agora, elas serão perdidas.
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
