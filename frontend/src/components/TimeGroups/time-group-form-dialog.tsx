"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { ClockIcon, PlusIcon, Trash2Icon } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MonthdaysField } from "@/components/TimeGroups/monthdays-field"
import { MonthsField } from "@/components/TimeGroups/months-field"
import { WeekdayCheckboxes } from "@/components/TimeGroups/weekday-checkboxes"
import { type Company } from "@/hooks/use-companies"
import {
    createTimeGroupFormSchema,
    type TimeGroupForm,
    type TimeRangeForm,
} from "@/hooks/use-time-groups"
import { type TimeGroupFormDialogProps } from "@/components/TimeGroups/types"

const EMPTY_RANGE: TimeRangeForm = {
    startTime: "08:00",
    endTime: "18:00",
    weekdays: ["mon", "tue", "wed", "thu", "fri"],
    monthdays: "*",
    months: "*",
}

// Pré-preenchimento padrão pra grupo novo: seg-sex 08-18h + sáb 08-12h,
// o horário comercial mais comum entre os clientes
const DEFAULT_RANGES: TimeRangeForm[] = [
    { ...EMPTY_RANGE },
    {
        startTime: "08:00",
        endTime: "12:00",
        weekdays: ["sat"],
        monthdays: "*",
        months: "*",
    },
]

export function TimeGroupFormDialog({
    open,
    onOpenChange,
    timeGroup,
    companies,
    onSave,
}: TimeGroupFormDialogProps) {
    const isEdit = !!timeGroup
    // Só uma empresa disponível (ex: dialog aberto de dentro do Flow, já travado na empresa do
    // flow) - pré-seleciona e esconde o combobox, sem exigir reescolher o que já é sabido
    const defaultCompanyId =
        companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<TimeGroupForm>({
        resolver: zodResolver(createTimeGroupFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            ranges: DEFAULT_RANGES.map((r) => ({ ...r })),
        } as any,
    })

    const { fields, append, remove } = useFieldArray({
        control,
        name: "ranges",
    })
    const companyId = watch("companyId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: timeGroup?.name ?? "",
            companyId: timeGroup?.companyId ?? defaultCompanyId,
            ranges: timeGroup
                ? timeGroup.ranges.map((r) => ({
                      startTime: r.startTime,
                      endTime: r.endTime,
                      weekdays: r.weekdays,
                      monthdays: r.monthdays,
                      months: r.months,
                  }))
                : DEFAULT_RANGES.map((r) => ({ ...r })),
        })
    }, [open, timeGroup, reset, defaultCompanyId])

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
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? "Editar grupo de horário"
                                : "Novo grupo de horário"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Grupo ${timeGroup.name}`
                                : "Preencha os dados para criar o grupo de horário"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="time-group-form"
                        onSubmit={onSubmit}
                        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                    >
                        <ScrollArea className="min-h-0">
                            <FieldGroup className="pr-3">
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: horario-comercial"
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
                                            itemToStringLabel={(c) => c.name}
                                            isItemEqualToValue={(a, b) =>
                                                a.id === b.id
                                            }
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
                                                {errors.companyId.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                )}

                                <Field>
                                    <div className="flex items-center justify-between">
                                        <FieldLabel>Períodos</FieldLabel>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                append({ ...EMPTY_RANGE })
                                            }
                                        >
                                            <PlusIcon />
                                            Adicionar período
                                        </Button>
                                    </div>
                                    {errors.ranges?.root && (
                                        <FieldError>
                                            {errors.ranges.root.message}
                                        </FieldError>
                                    )}
                                    {errors.ranges?.message && (
                                        <FieldError>
                                            {errors.ranges.message}
                                        </FieldError>
                                    )}
                                    <FieldDescription>
                                        Um período não pode cruzar a virada do
                                        dia. Para cobrir das 08:00 até as 08:00
                                        do dia seguinte, crie dois períodos:
                                        08:00–23:59 e 00:00–07:59.
                                    </FieldDescription>

                                    <div className="flex flex-col gap-3 p-0.5">
                                        {fields.map((field, index) => (
                                            <Card key={field.id}>
                                                <CardContent className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Período {index + 1}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            disabled={
                                                                fields.length <=
                                                                1
                                                            }
                                                            onClick={() =>
                                                                remove(index)
                                                            }
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            <span className="sr-only">
                                                                Remover período
                                                            </span>
                                                        </Button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <FieldLabel>
                                                                Início
                                                            </FieldLabel>
                                                            <InputGroup>
                                                                <InputGroupAddon>
                                                                    <ClockIcon />
                                                                </InputGroupAddon>
                                                                <InputGroupInput
                                                                    type="time"
                                                                    className="[&::-webkit-calendar-picker-indicator]:hidden"
                                                                    {...register(
                                                                        `ranges.${index}.startTime`
                                                                    )}
                                                                />
                                                            </InputGroup>
                                                            {errors.ranges?.[
                                                                index
                                                            ]?.startTime && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .ranges[
                                                                            index
                                                                        ]
                                                                            ?.startTime
                                                                            ?.message
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                        <Field>
                                                            <FieldLabel>
                                                                Fim
                                                            </FieldLabel>
                                                            <InputGroup>
                                                                <InputGroupAddon>
                                                                    <ClockIcon />
                                                                </InputGroupAddon>
                                                                <InputGroupInput
                                                                    type="time"
                                                                    className="[&::-webkit-calendar-picker-indicator]:hidden"
                                                                    {...register(
                                                                        `ranges.${index}.endTime`
                                                                    )}
                                                                />
                                                            </InputGroup>
                                                            {errors.ranges?.[
                                                                index
                                                            ]?.endTime && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .ranges[
                                                                            index
                                                                        ]
                                                                            ?.endTime
                                                                            ?.message
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                    </div>

                                                    <Field>
                                                        <FieldLabel>
                                                            Dias da semana
                                                        </FieldLabel>
                                                        <Controller
                                                            control={control}
                                                            name={`ranges.${index}.weekdays`}
                                                            render={({
                                                                field: f,
                                                            }) => (
                                                                <WeekdayCheckboxes
                                                                    value={
                                                                        f.value
                                                                    }
                                                                    onChange={
                                                                        f.onChange
                                                                    }
                                                                />
                                                            )}
                                                        />
                                                        {errors.ranges?.[index]
                                                            ?.weekdays && (
                                                            <FieldError>
                                                                {
                                                                    errors
                                                                        .ranges[
                                                                        index
                                                                    ]?.weekdays
                                                                        ?.message
                                                                }
                                                            </FieldError>
                                                        )}
                                                    </Field>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <FieldLabel>
                                                                Dias do mês
                                                            </FieldLabel>
                                                            <Controller
                                                                control={
                                                                    control
                                                                }
                                                                name={`ranges.${index}.monthdays`}
                                                                render={({
                                                                    field: f,
                                                                }) => (
                                                                    <MonthdaysField
                                                                        value={
                                                                            f.value
                                                                        }
                                                                        onChange={
                                                                            f.onChange
                                                                        }
                                                                    />
                                                                )}
                                                            />
                                                            {errors.ranges?.[
                                                                index
                                                            ]?.monthdays && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .ranges[
                                                                            index
                                                                        ]
                                                                            ?.monthdays
                                                                            ?.message
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                        <Field>
                                                            <FieldLabel>
                                                                Meses
                                                            </FieldLabel>
                                                            <Controller
                                                                control={
                                                                    control
                                                                }
                                                                name={`ranges.${index}.months`}
                                                                render={({
                                                                    field: f,
                                                                }) => (
                                                                    <MonthsField
                                                                        value={
                                                                            f.value
                                                                        }
                                                                        onChange={
                                                                            f.onChange
                                                                        }
                                                                    />
                                                                )}
                                                            />
                                                            {errors.ranges?.[
                                                                index
                                                            ]?.months && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .ranges[
                                                                            index
                                                                        ]
                                                                            ?.months
                                                                            ?.message
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </Field>
                            </FieldGroup>
                        </ScrollArea>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => requestClose(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form="time-group-form"
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
                                ? ` no grupo "${timeGroup.name}"`
                                : " neste grupo"}
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
