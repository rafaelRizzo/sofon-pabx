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
import { Badge } from "@/components/ui/badge"
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
import { RouteDestinationField } from "@/components/RouteDestination/route-destination-field"
import { TimeGroupsCombobox } from "@/components/TimeConditions/time-groups-combobox"
import { type Company } from "@/hooks/use-companies"
import {
    createTimeConditionFormSchema,
    type TimeCondition,
    type TimeConditionForm,
} from "@/hooks/use-time-conditions"
import { useTimeGroups } from "@/hooks/use-time-groups"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    timeCondition: TimeCondition | null
    companies: Company[]
    onSave: (form: TimeConditionForm) => Promise<boolean>
}

export function TimeConditionFormDialog({
    open,
    onOpenChange,
    timeCondition,
    companies,
    onSave,
}: Props) {
    const isEdit = !!timeCondition

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<TimeConditionForm>({
        resolver: zodResolver(createTimeConditionFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: "",
            groupIds: [],
            trueRoute: { type: "hangup" },
            falseRoute: { type: "hangup" },
        },
    })

    const companyId = watch("companyId")
    const groupIds = watch("groupIds")
    const trueRoute = watch("trueRoute")
    const falseRoute = watch("falseRoute")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    // Grupos de horário disponíveis pra vincular — dependem da empresa escolhida no próprio form,
    // não do filtro da página (o dialog é independente da empresa que está sendo listada na tabela)
    const { timeGroups } = useTimeGroups(companyId || undefined)

    useEffect(() => {
        if (!open) return
        reset({
            name: timeCondition?.name ?? "",
            companyId: timeCondition?.companyId ?? "",
            groupIds: timeCondition?.timeGroups.map((tg) => tg.timeGroup.id) ?? [],
            trueRoute: timeCondition?.trueRoute ?? { type: "hangup" },
            falseRoute: timeCondition?.falseRoute ?? { type: "hangup" },
        })
    }, [open, timeCondition, reset])

    // Ao trocar de empresa na criação, grupos/destinos escolhidos pra empresa anterior não fazem
    // mais sentido (IDs de outra empresa) — reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, { shouldValidate: true, shouldDirty: true })
        setValue("groupIds", [], { shouldValidate: true, shouldDirty: true })
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
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Editar condição de horário" : "Nova condição de horário"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Condição ${timeCondition.name}`
                                : "Preencha os dados para criar a condição de horário"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="time-condition-form"
                        onSubmit={onSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: horario-comercial"
                                        {...register("name")}
                                    />
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

                                <Field>
                                    <FieldLabel>Grupos de horário</FieldLabel>
                                    {isEdit ? (
                                        <>
                                            <div className="flex flex-wrap gap-1.5">
                                                {timeCondition.timeGroups.map(({ timeGroup }) => (
                                                    <Badge key={timeGroup.id} variant="outline">
                                                        {timeGroup.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <FieldDescription>
                                                Os grupos vinculados só podem ser definidos na criação da condição.
                                            </FieldDescription>
                                        </>
                                    ) : !companyId ? (
                                        <FieldDescription>
                                            Selecione uma empresa primeiro para ver os grupos de horário disponíveis.
                                        </FieldDescription>
                                    ) : (
                                        <>
                                            <TimeGroupsCombobox
                                                timeGroups={timeGroups}
                                                value={groupIds}
                                                onChange={(v) =>
                                                    setValue("groupIds", v, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    })
                                                }
                                            />
                                            {errors.groupIds && (
                                                <FieldError>{errors.groupIds.message}</FieldError>
                                            )}
                                        </>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Destino dentro do horário</FieldLabel>
                                    <RouteDestinationField
                                        value={trueRoute}
                                        onChange={(d) =>
                                            setValue("trueRoute", d, { shouldValidate: true, shouldDirty: true })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada é direcionada quando cai dentro de algum dos grupos de horário vinculados.
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel>Destino fora do horário</FieldLabel>
                                    <RouteDestinationField
                                        value={falseRoute}
                                        onChange={(d) =>
                                            setValue("falseRoute", d, { shouldValidate: true, shouldDirty: true })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada é direcionada quando cai fora de todos os grupos de horário vinculados.
                                    </FieldDescription>
                                </Field>
                            </FieldGroup>
                        </div>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="time-condition-form" disabled={isSubmitting}>
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
                            {isEdit ? ` na condição "${timeCondition.name}"` : " nesta condição"}. Se sair
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
