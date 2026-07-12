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
import { RouteDestinationField } from "@/components/RouteDestination/route-destination-field"
import { type Company } from "@/hooks/use-companies"
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

const OPERATOR_ITEMS = VARIABLE_RULE_OPERATORS.map((op) => ({ value: op, label: VARIABLE_RULE_OPERATOR_LABELS[op] }))
const COMBINATOR_ITEMS: { value: Combinator; label: string }[] = [
    { value: "and", label: "E (todas as regras)" },
    { value: "or", label: "OU (qualquer regra)" },
]

const emptyRule = { variable: "", operator: "filled" as VariableRuleOperator, value: "" }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    variableCondition: VariableCondition | null
    companies: Company[]
    onSave: (form: VariableConditionForm) => Promise<boolean>
}

export function VariableConditionFormDialog({
    open,
    onOpenChange,
    variableCondition,
    companies,
    onSave,
}: Props) {
    const isEdit = !!variableCondition

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
            companyId: "",
            combinator: "and",
            rules: [emptyRule],
            trueRoute: { type: "hangup" },
            falseRoute: { type: "hangup" },
        },
    })

    const ruleFields = useFieldArray({ control, name: "rules" })

    const companyId = watch("companyId")
    const combinator = watch("combinator")
    const rules = watch("rules")
    const trueRoute = watch("trueRoute")
    const falseRoute = watch("falseRoute")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: variableCondition?.name ?? "",
            companyId: variableCondition?.companyId ?? "",
            combinator: variableCondition?.combinator ?? "and",
            rules: variableCondition?.rules?.length ? variableCondition.rules : [emptyRule],
            trueRoute: variableCondition?.trueRoute ?? { type: "hangup" },
            falseRoute: variableCondition?.falseRoute ?? { type: "hangup" },
        })
    }, [open, variableCondition, reset])

    // Ao trocar de empresa na criação, os destinos escolhidos pra empresa anterior não fazem mais
    // sentido (IDs de outra empresa) — reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, { shouldValidate: true, shouldDirty: true })
        setValue("trueRoute", { type: "hangup" }, { shouldDirty: true })
        setValue("falseRoute", { type: "hangup" }, { shouldDirty: true })
    }

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
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Editar condição de variável" : "Nova condição de variável"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Condição ${variableCondition.name}`
                                : "Valida variáveis de canal e direciona por trueRoute/falseRoute"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="variable-condition-form"
                        onSubmit={onSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input placeholder="Ex: cpf-valido" {...register("name")} />
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
                                        {errors.companyId && (
                                            <FieldError>{errors.companyId.message}</FieldError>
                                        )}
                                    </Field>
                                )}

                                <Field className="max-w-60">
                                    <FieldLabel>Combinar regras</FieldLabel>
                                    <Select
                                        items={COMBINATOR_ITEMS}
                                        value={combinator}
                                        onValueChange={(v) =>
                                            setValue("combinator", v as Combinator, { shouldDirty: true })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Combinador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMBINATOR_ITEMS.map((c) => (
                                                <SelectItem key={c.value} value={c.value}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        &quot;E&quot; exige que todas as regras batam; &quot;OU&quot; basta uma.
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <div className="flex items-center justify-between">
                                        <FieldLabel>Regras</FieldLabel>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => ruleFields.append(emptyRule, { shouldFocus: false })}
                                        >
                                            <PlusIcon />
                                            Adicionar
                                        </Button>
                                    </div>
                                    {errors.rules?.root && <FieldError>{errors.rules.root.message}</FieldError>}
                                    {ruleFields.fields.length === 0 ? (
                                        <FieldDescription>Nenhuma regra configurada.</FieldDescription>
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
                                            {ruleFields.fields.map((field, index) => {
                                                const operator = rules?.[index]?.operator ?? "filled"
                                                const needsValue = ruleNeedsValue(operator)
                                                return (
                                                    <div
                                                        key={field.id}
                                                        className="grid grid-cols-[1fr_9rem_1fr_1.75rem] items-start gap-2"
                                                    >
                                                        <div>
                                                            <Input
                                                                placeholder="CALLERID(num)"
                                                                {...register(`rules.${index}.variable`)}
                                                            />
                                                            {errors.rules?.[index]?.variable && (
                                                                <FieldError>
                                                                    {errors.rules[index]?.variable?.message}
                                                                </FieldError>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <Select
                                                                items={OPERATOR_ITEMS}
                                                                value={operator}
                                                                onValueChange={(v) =>
                                                                    setValue(
                                                                        `rules.${index}.operator`,
                                                                        v as VariableRuleOperator,
                                                                        { shouldDirty: true, shouldValidate: true }
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Operador" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {VARIABLE_RULE_OPERATORS.map((op) => (
                                                                        <SelectItem key={op} value={op}>
                                                                            {VARIABLE_RULE_OPERATOR_LABELS[op]}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div>
                                                            <Input
                                                                placeholder={needsValue ? "11" : "—"}
                                                                disabled={!needsValue}
                                                                {...register(`rules.${index}.value`)}
                                                            />
                                                            {errors.rules?.[index]?.value && (
                                                                <FieldError>
                                                                    {errors.rules[index]?.value?.message}
                                                                </FieldError>
                                                            )}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => ruleFields.remove(index)}
                                                        >
                                                            <XIcon />
                                                            <span className="sr-only">Remover regra</span>
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Destino se verdadeiro</FieldLabel>
                                    <RouteDestinationField
                                        value={trueRoute}
                                        onChange={(d) =>
                                            setValue("trueRoute", d, { shouldValidate: true, shouldDirty: true })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada é direcionada quando as regras baterem.
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel>Destino se falso</FieldLabel>
                                    <RouteDestinationField
                                        value={falseRoute}
                                        onChange={(d) =>
                                            setValue("falseRoute", d, { shouldValidate: true, shouldDirty: true })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada é direcionada quando as regras não baterem.
                                    </FieldDescription>
                                </Field>
                            </FieldGroup>
                        </div>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="variable-condition-form" disabled={isSubmitting}>
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
                            {isEdit ? ` na condição "${variableCondition.name}"` : " nesta condição"}. Se sair
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
