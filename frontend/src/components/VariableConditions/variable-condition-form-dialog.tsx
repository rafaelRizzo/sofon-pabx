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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { VariableRefPickerButton } from "@/components/VariableConditions/variable-ref-picker-button"
import { type Company } from "@/hooks/use-companies"
import { useVariableCatalog } from "@/hooks/use-variable-catalog"
import { cn } from "@/lib/utils"
import {
    createVariableConditionFormSchema,
    ruleNeedsValue,
    VARIABLE_RULE_OPERATOR_LABELS,
    VARIABLE_RULE_OPERATORS,
    type Combinator,
    type VariableCondition,
    type VariableConditionForm,
    type VariableRuleOperator,
} from "@/hooks/use-variable-conditions"

// Nome de identificador simples que não bate com nenhum builtin conhecido nem está no catálogo -
// pode ser uma variável definida fora do fluxo (API, script externo), então o aviso é só
// informativo (não bloqueia o submit, que já é validado por ruleFieldSchema)
const KNOWN_PLAIN_IDENTIFIERS = new Set(["EXTEN", "UNIQUEID"])
function unknownVariableWarning(
    rawValue: string,
    catalogNames: Set<string>
): string | null {
    const value = rawValue.trim()
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return null
    if (KNOWN_PLAIN_IDENTIFIERS.has(value) || catalogNames.has(value)) {
        return null
    }
    return "Não está no catálogo nem é uma variável nativa conhecida - confira o nome."
}

const OPERATOR_ITEMS = VARIABLE_RULE_OPERATORS.map((op) => ({
    value: op,
    label: VARIABLE_RULE_OPERATOR_LABELS[op],
}))
const COMBINATOR_ITEMS: { value: Combinator; label: string }[] = [
    { value: "and", label: "E (todas as regras)" },
    { value: "or", label: "OU (qualquer regra)" },
]

const emptyRule = {
    variable: "",
    operator: "filled" as VariableRuleOperator,
    value: "",
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variableCondition: VariableCondition | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `variableCondition` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: VariableConditionForm) => Promise<boolean>
    onDelete?: () => void
}

export function VariableConditionFormDialog({
    open,
    onOpenChange,
    variableCondition,
    loading = false,
    companies,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!variableCondition
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
    } = useForm<VariableConditionForm>({
        resolver: zodResolver(createVariableConditionFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            combinator: "and",
            rules: [emptyRule],
        },
    })

    const ruleFields = useFieldArray({ control, name: "rules" })

    const companyId = watch("companyId")
    const combinator = watch("combinator")
    const rules = watch("rules")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null
    const { variables: catalogVariables } = useVariableCatalog(companyId)
    const catalogNames = new Set(catalogVariables.map((v) => v.name))

    useEffect(() => {
        if (!open) return
        reset({
            name: variableCondition?.name ?? "",
            companyId: variableCondition?.companyId ?? defaultCompanyId,
            combinator: variableCondition?.combinator ?? "and",
            rules: variableCondition?.rules?.length
                ? variableCondition.rules
                : [emptyRule],
        })
    }, [open, variableCondition, reset, defaultCompanyId])

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
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={3} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit
                                        ? "Editar condição de variável"
                                        : "Nova condição de variável"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Condição ${variableCondition.name}`
                                        : "Preencha os dados para criar a condição de variável"}
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                id="variable-condition-form"
                                onSubmit={onSubmit}
                                className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                            >
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input
                                                placeholder="Ex: cpf-valido"
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

                                        <Field className="max-w-60">
                                            <FieldLabel>
                                                Combinar regras
                                            </FieldLabel>
                                            <Select
                                                items={COMBINATOR_ITEMS}
                                                value={combinator}
                                                onValueChange={(v) =>
                                                    setValue(
                                                        "combinator",
                                                        v as Combinator,
                                                        { shouldDirty: true }
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Combinador" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {COMBINATOR_ITEMS.map(
                                                        (c) => (
                                                            <SelectItem
                                                                key={c.value}
                                                                value={c.value}
                                                            >
                                                                {c.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FieldDescription>
                                                &quot;E&quot; exige que todas as
                                                regras batam; &quot;OU&quot;
                                                basta uma.
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <div className="flex items-center justify-between">
                                                <FieldLabel>Regras</FieldLabel>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        ruleFields.append(
                                                            emptyRule,
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
                                                Os operadores &quot;CPF
                                                válido&quot;/&quot;CNPJ
                                                válido&quot; conferem o dígito
                                                verificador de verdade (não só o
                                                tamanho). Pra aceitar qualquer
                                                um dos dois na mesma variável,
                                                use combinador &quot;OU&quot;
                                                com uma regra de cada.
                                            </FieldDescription>
                                            {errors.rules?.root && (
                                                <FieldError>
                                                    {errors.rules.root.message}
                                                </FieldError>
                                            )}
                                            {ruleFields.fields.length === 0 ? (
                                                <FieldDescription>
                                                    Nenhuma regra configurada.
                                                </FieldDescription>
                                            ) : (
                                                <div className="space-y-2 rounded-md border p-2">
                                                    <div className="grid grid-cols-[1fr_9rem_1fr_1.75rem] gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Variável
                                                        </span>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Operador
                                                        </span>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Valor
                                                        </span>
                                                        <span />
                                                    </div>
                                                    {ruleFields.fields.map(
                                                        (field, index) => {
                                                            const operator =
                                                                rules?.[index]
                                                                    ?.operator ??
                                                                "filled"
                                                            const needsValue =
                                                                ruleNeedsValue(
                                                                    operator
                                                                )
                                                            return (
                                                                <div
                                                                    key={
                                                                        field.id
                                                                    }
                                                                    className={cn(
                                                                        "grid items-start gap-2",
                                                                        needsValue
                                                                            ? "grid-cols-[1fr_9rem_1fr_1.75rem]"
                                                                            : "grid-cols-[1fr_1fr_1.75rem]"
                                                                    )}
                                                                >
                                                                    <div>
                                                                        <div className="flex gap-1">
                                                                            <Input
                                                                                placeholder="CALLERID(num)"
                                                                                className="flex-1"
                                                                                {...register(
                                                                                    `rules.${index}.variable`
                                                                                )}
                                                                            />
                                                                            <VariableRefPickerButton
                                                                                companyId={
                                                                                    companyId
                                                                                }
                                                                                onSelect={(
                                                                                    name
                                                                                ) =>
                                                                                    setValue(
                                                                                        `rules.${index}.variable`,
                                                                                        name,
                                                                                        {
                                                                                            shouldDirty: true,
                                                                                            shouldValidate: true,
                                                                                        }
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                        {errors
                                                                            .rules?.[
                                                                            index
                                                                        ]
                                                                            ?.variable ? (
                                                                            <FieldError>
                                                                                {
                                                                                    errors
                                                                                        .rules[
                                                                                        index
                                                                                    ]
                                                                                        ?.variable
                                                                                        ?.message
                                                                                }
                                                                            </FieldError>
                                                                        ) : (
                                                                            (() => {
                                                                                const warning =
                                                                                    unknownVariableWarning(
                                                                                        rules?.[
                                                                                            index
                                                                                        ]
                                                                                            ?.variable ??
                                                                                            "",
                                                                                        catalogNames
                                                                                    )
                                                                                return warning ? (
                                                                                    <FieldDescription className="text-amber-600 dark:text-amber-400">
                                                                                        {
                                                                                            warning
                                                                                        }
                                                                                    </FieldDescription>
                                                                                ) : null
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Select
                                                                            items={
                                                                                OPERATOR_ITEMS
                                                                            }
                                                                            value={
                                                                                operator
                                                                            }
                                                                            onValueChange={(
                                                                                v
                                                                            ) =>
                                                                                setValue(
                                                                                    `rules.${index}.operator`,
                                                                                    v as VariableRuleOperator,
                                                                                    {
                                                                                        shouldDirty: true,
                                                                                        shouldValidate: true,
                                                                                    }
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="w-full">
                                                                                <SelectValue placeholder="Operador" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {VARIABLE_RULE_OPERATORS.map(
                                                                                    (
                                                                                        op
                                                                                    ) => (
                                                                                        <SelectItem
                                                                                            key={
                                                                                                op
                                                                                            }
                                                                                            value={
                                                                                                op
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                VARIABLE_RULE_OPERATOR_LABELS[
                                                                                                    op
                                                                                                ]
                                                                                            }
                                                                                        </SelectItem>
                                                                                    )
                                                                                )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    {needsValue && (
                                                                        <div>
                                                                            <Input
                                                                                placeholder="11"
                                                                                {...register(
                                                                                    `rules.${index}.value`
                                                                                )}
                                                                            />
                                                                            {errors
                                                                                .rules?.[
                                                                                index
                                                                            ]
                                                                                ?.value && (
                                                                                <FieldError>
                                                                                    {
                                                                                        errors
                                                                                            .rules[
                                                                                            index
                                                                                        ]
                                                                                            ?.value
                                                                                            ?.message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() =>
                                                                            ruleFields.remove(
                                                                                index
                                                                            )
                                                                        }
                                                                    >
                                                                        <XIcon />
                                                                        <span className="sr-only">
                                                                            Remover
                                                                            regra
                                                                        </span>
                                                                    </Button>
                                                                </div>
                                                            )
                                                        }
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
                                    form="variable-condition-form"
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
                                ? ` na condição "${variableCondition.name}"`
                                : " nesta condição"}
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
