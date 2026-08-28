"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
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
import { VariableInsertField } from "@/components/variable-insert-field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Company } from "@/hooks/use-companies"
import {
    createFormatterNodeFormSchema,
    type FormatterNode,
    type FormatterNodeForm,
} from "@/hooks/use-formatter-nodes"

const MASK_PRESETS = [
    { label: "CPF/CNPJ", masks: ["000.000.000-00", "00.000.000/0000-00"] },
    { label: "CEP", masks: ["00000-000"] },
    { label: "Telefone BR", masks: ["(00) 0000-0000", "(00) 00000-0000"] },
    { label: "Placa", masks: ["AAA0A00", "AAA-0000"] },
]

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    formatterNode: FormatterNode | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `formatterNode` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: FormatterNodeForm) => Promise<boolean>
    onDelete?: () => void
}

export function FormatterNodeFormDialog({
    open,
    onOpenChange,
    formatterNode,
    loading = false,
    companies,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!formatterNode
    const defaultCompanyId = companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        getValues,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<FormatterNodeForm>({
        resolver: zodResolver(createFormatterNodeFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            inputVariable: "",
            outputVariable: "",
            masks: [],
        },
    })

    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    // `masks` é array de strings puras (não de objetos), então não dá pra usar useFieldArray
    // (RHF só suporta field array em cima de array de objetos) - lista controlada via watch/setValue
    const masks = watch("masks") ?? []
    function appendMask() {
        setValue("masks", [...masks, ""], { shouldDirty: true, shouldValidate: true })
    }
    function removeMask(index: number) {
        setValue(
            "masks",
            masks.filter((_, i) => i !== index),
            { shouldDirty: true, shouldValidate: true }
        )
    }
    function updateMask(index: number, value: string) {
        const next = [...masks]
        next[index] = value
        setValue("masks", next, { shouldDirty: true, shouldValidate: true })
    }

    useEffect(() => {
        if (!open) return
        reset({
            name: formatterNode?.name ?? "",
            companyId: formatterNode?.companyId ?? defaultCompanyId,
            inputVariable: formatterNode?.inputVariable ?? "",
            outputVariable: formatterNode?.outputVariable ?? "",
            masks: formatterNode?.masks ?? [],
        })
    }, [open, formatterNode, reset, defaultCompanyId])

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

    function applyPreset(presetMasks: string[]) {
        setValue("masks", presetMasks, { shouldDirty: true, shouldValidate: true })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={requestClose}>
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={4} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>{isEdit ? "Editar nó Formatter" : "Novo nó Formatter"}</DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Nó ${formatterNode.name}`
                                        : "Aplica uma máscara numa variável de canal durante a chamada"}
                                </DialogDescription>
                            </DialogHeader>

                            <form id="formatter-node-form" onSubmit={onSubmit} className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]">
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input placeholder="Ex: formatar-cpf-cnpj" {...register("name")} />
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

                                        <Field>
                                            <FieldLabel>Variável de entrada</FieldLabel>
                                            <VariableInsertField
                                                name="inputVariable"
                                                register={register}
                                                setValue={setValue}
                                                getValues={getValues}
                                                companyId={companyId}
                                                placeholder="Ex: CPF_CNPJ ou CALLERID(num)"
                                            />
                                            {errors.inputVariable && <FieldError>{errors.inputVariable.message}</FieldError>}
                                            <FieldDescription>
                                                Variável ou expressão de canal a ler. O valor é limpo (só dígitos/letras) antes
                                                de aplicar a máscara.
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <FieldLabel>Variável de saída</FieldLabel>
                                            <Input placeholder="Ex: CPF_CNPJ_FORMATADO" {...register("outputVariable")} />
                                            {errors.outputVariable && <FieldError>{errors.outputVariable.message}</FieldError>}
                                            <FieldDescription>Onde o resultado formatado é gravado.</FieldDescription>
                                        </Field>

                                        <Field>
                                            <div className="flex items-center justify-between">
                                                <FieldLabel>Máscaras</FieldLabel>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={appendMask}
                                                >
                                                    <PlusIcon />
                                                    Adicionar
                                                </Button>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {MASK_PRESETS.map((preset) => (
                                                    <Button
                                                        key={preset.label}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => applyPreset(preset.masks)}
                                                    >
                                                        {preset.label}
                                                    </Button>
                                                ))}
                                            </div>

                                            {errors.masks?.message && <FieldError>{errors.masks.message}</FieldError>}
                                            {masks.length === 0 ? (
                                                <FieldDescription>Nenhuma máscara configurada.</FieldDescription>
                                            ) : (
                                                <div className="space-y-2 rounded-md border p-2">
                                                    {masks.map((mask, index) => (
                                                        <div key={index} className="grid grid-cols-[1fr_1.75rem] items-start gap-2">
                                                            <div>
                                                                <Input
                                                                    placeholder="000.000.000-00"
                                                                    value={mask}
                                                                    onChange={(e) => updateMask(index, e.target.value)}
                                                                />
                                                                {errors.masks?.[index] && (
                                                                    <FieldError>{errors.masks[index]?.message}</FieldError>
                                                                )}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => removeMask(index)}
                                                            >
                                                                <XIcon />
                                                                <span className="sr-only">Remover máscara</span>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <FieldDescription>
                                                Testa as máscaras em ordem, usa a primeira cujo nº de tokens bate com o
                                                tamanho do valor limpo. Legenda: <code>0</code> = dígito, <code>A</code> =
                                                letra, <code>*</code> = alfanumérico, qualquer outro caractere é literal.
                                                Ex: <code>000.000.000-00</code> formata <code>12345678900</code> em{" "}
                                                <code>123.456.789-00</code>.
                                            </FieldDescription>
                                        </Field>
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
                                <Button type="submit" form="formatter-node-form" disabled={isSubmitting}>
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
                            {isEdit ? ` no nó "${formatterNode.name}"` : " neste nó"}. Se sair agora, elas serão perdidas.
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
