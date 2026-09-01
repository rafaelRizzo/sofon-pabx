"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, InfoIcon, PlusIcon, XIcon } from "lucide-react"
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
import { VariableCombobox } from "@/components/variable-combobox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
    cleanMaskValue,
    findMatchingMaskIndex,
    applyMaskAtIndex,
    describeMask,
    splitMaskParts,
    joinMaskParts,
} from "@/lib/format-mask"
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
    // Prefixo/sufixo são só uma UI melhor pra editar texto fixo antes/depois do padrão, sem
    // pedir pro usuário misturar tudo numa string só - o resultado (join) continua sendo a
    // mesma string única salva em `masks[index]`, formato inalterado no contrato com o backend.
    function updateMaskPart(index: number, part: keyof ReturnType<typeof splitMaskParts>, value: string) {
        const parts = splitMaskParts(masks[index] ?? "")
        updateMask(index, joinMaskParts({ ...parts, [part]: value }))
    }

    // Testador em tempo real: roda o mesmo algoritmo do backend (lib/format-mask.ts espelha
    // utils/format-mask.ts) localmente, sem chamar a API, pra mostrar de cara qual máscara bate e
    // qual seria a saída - só ver o valor formatado enquanto digita já vale mais que a legenda.
    const [testValue, setTestValue] = useState("")
    const cleanTestValue = useMemo(() => cleanMaskValue(testValue), [testValue])
    const matchedIndex = useMemo(
        () => (cleanTestValue ? findMatchingMaskIndex(cleanTestValue, masks) : -1),
        [cleanTestValue, masks]
    )
    const matchedOutput =
        matchedIndex >= 0 ? applyMaskAtIndex(cleanTestValue, masks[matchedIndex] as string) : null

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
                                            <VariableCombobox
                                                companyId={companyId}
                                                value={watch("inputVariable") || null}
                                                onChange={(name) =>
                                                    setValue("inputVariable", name ?? "", {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    })
                                                }
                                            />
                                            {errors.inputVariable && <FieldError>{errors.inputVariable.message}</FieldError>}
                                            <FieldDescription>
                                                Variável do catálogo a ler. O valor é limpo (só dígitos/letras) antes de
                                                aplicar a máscara.
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <FieldLabel>Variável de saída</FieldLabel>
                                            <VariableCombobox
                                                companyId={companyId}
                                                value={watch("outputVariable") || null}
                                                onChange={(name) =>
                                                    setValue("outputVariable", name ?? "", {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    })
                                                }
                                            />
                                            {errors.outputVariable && <FieldError>{errors.outputVariable.message}</FieldError>}
                                            <FieldDescription>
                                                Variável do catálogo onde o resultado formatado é gravado.
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <FieldLabel>Máscaras</FieldLabel>
                                                    <TooltipProvider delay={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger
                                                                render={
                                                                    <button
                                                                        type="button"
                                                                        className="text-muted-foreground hover:text-foreground"
                                                                    >
                                                                        <InfoIcon className="size-3.5" />
                                                                        <span className="sr-only">
                                                                            Como funciona a máscara
                                                                        </span>
                                                                    </button>
                                                                }
                                                            />
                                                            <TooltipContent className="max-w-64">
                                                                Testa em ordem, usa a primeira cujo nº de tokens bate
                                                                com o tamanho do valor limpo. <code>0</code> = dígito,{" "}
                                                                <code>A</code> = letra, <code>*</code> = alfanumérico,
                                                                outro caractere é literal (fixo na saída). Pra prefixo
                                                                ou sufixo, só digitar o texto fixo antes/depois dos
                                                                tokens, ex: <code>55 (00) 00000-0000</code>.
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
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

                                            {/* Testador fica logo acima da lista (não depois dela) - o resultado
                                            aparece na mesma linha do input, sem precisar rolar pra ver o que digitou */}
                                            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2 py-1.5">
                                                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                                    Testar
                                                </span>
                                                <Input
                                                    placeholder="Digite um valor de exemplo..."
                                                    value={testValue}
                                                    onChange={(e) => setTestValue(e.target.value)}
                                                    className="h-8 flex-1 bg-transparent shadow-none"
                                                />
                                                {testValue.trim() !== "" && (
                                                    <span
                                                        className={cn(
                                                            "flex shrink-0 items-center gap-1 text-sm font-medium",
                                                            matchedOutput !== null
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-red-600 dark:text-red-500"
                                                        )}
                                                        title={
                                                            matchedOutput !== null
                                                                ? `Bateu com ${masks[matchedIndex]}`
                                                                : `Nenhuma máscara bate (${cleanTestValue.length} caractere${cleanTestValue.length === 1 ? "" : "s"} depois de limpar)`
                                                        }
                                                    >
                                                        {matchedOutput !== null ? (
                                                            <>
                                                                <CheckIcon className="size-4 shrink-0" />
                                                                <code>{matchedOutput}</code>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XIcon className="size-4 shrink-0" />
                                                                Sem match
                                                            </>
                                                        )}
                                                    </span>
                                                )}
                                            </div>

                                            {errors.masks?.message && <FieldError>{errors.masks.message}</FieldError>}
                                            {masks.length === 0 ? (
                                                <FieldDescription>Nenhuma máscara configurada.</FieldDescription>
                                            ) : (
                                                <div className="space-y-3 rounded-md border p-2">
                                                    <div className="grid grid-cols-[1.25rem_5rem_1fr_5rem_1.75rem] gap-2 px-0.5">
                                                        <span />
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Prefixo
                                                        </span>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Padrão
                                                        </span>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Sufixo
                                                        </span>
                                                        <span />
                                                    </div>
                                                    {masks.map((mask, index) => {
                                                        const isMatch = testValue.trim() !== "" && index === matchedIndex
                                                        const parts = splitMaskParts(mask)
                                                        return (
                                                            <div key={index} className="space-y-1">
                                                                <div className="grid grid-cols-[1.25rem_5rem_1fr_5rem_1.75rem] items-start gap-2">
                                                                    <div className="flex h-9 items-center justify-center">
                                                                        {isMatch && (
                                                                            <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                                                                        )}
                                                                    </div>
                                                                    <Input
                                                                        placeholder="55"
                                                                        value={parts.prefix}
                                                                        onChange={(e) => updateMaskPart(index, "prefix", e.target.value)}
                                                                    />
                                                                    <Input
                                                                        placeholder="(00) 00000-0000"
                                                                        value={parts.core}
                                                                        onChange={(e) => updateMaskPart(index, "core", e.target.value)}
                                                                        className={cn(
                                                                            isMatch &&
                                                                                "border-emerald-500 ring-1 ring-emerald-500/30 dark:border-emerald-400"
                                                                        )}
                                                                    />
                                                                    <Input
                                                                        placeholder=""
                                                                        value={parts.suffix}
                                                                        onChange={(e) => updateMaskPart(index, "suffix", e.target.value)}
                                                                    />
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
                                                                {mask.trim() !== "" && (
                                                                    <div className="pl-[1.25rem]">
                                                                        <MaskBreakdown mask={mask} />
                                                                    </div>
                                                                )}
                                                                {errors.masks?.[index] && (
                                                                    <div className="pl-[1.25rem]">
                                                                        <FieldError>{errors.masks[index]?.message}</FieldError>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
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

const TOKEN_KIND_LABELS: Record<"digit" | "letter" | "alnum", string> = {
    digit: "dígito",
    letter: "letra",
    alnum: "alfanumérico",
}

// Decompõe a máscara em chips visuais - texto fixo (cinza) vs buracos que consomem caractere
// (azul) - pra deixar óbvio que prefixo/sufixo é só digitar texto fixo antes/depois dos tokens,
// sem precisar de um campo separado pra isso.
function MaskBreakdown({ mask }: { mask: string }) {
    const segments = describeMask(mask)
    return (
        <div className="mt-1 flex flex-wrap items-center gap-1">
            {segments.map((segment, i) =>
                segment.kind === "literal" ? (
                    <code
                        key={i}
                        className="rounded bg-muted px-1 py-0.5 text-xs whitespace-pre text-muted-foreground"
                    >
                        {segment.text}
                    </code>
                ) : (
                    <span
                        key={i}
                        className="rounded bg-blue-500/15 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-400/20 dark:text-blue-300"
                    >
                        {segment.count} {TOKEN_KIND_LABELS[segment.kind]}
                        {segment.count > 1 ? "s" : ""}
                    </span>
                )
            )}
        </div>
    )
}
