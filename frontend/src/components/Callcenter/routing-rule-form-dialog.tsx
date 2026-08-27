"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClockIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

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
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { NumberInput } from "@/components/ui/number-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { WeekdayCheckboxes } from "@/components/TimeGroups/weekday-checkboxes"
import {
    createRoutingRuleFormSchema,
    type RoutingRule,
    type RoutingRuleForm,
} from "@/hooks/use-routing-rules"
import { type Weekday } from "@/hooks/use-time-groups"
import { type Trunk } from "@/hooks/use-trunks"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    routingRule: RoutingRule | null
    companyId: string
    trunks: Trunk[]
    onSave: (form: RoutingRuleForm) => Promise<boolean>
}

export function RoutingRuleFormDialog({
    open,
    onOpenChange,
    routingRule,
    companyId,
    trunks,
    onSave,
}: Props) {
    const isEdit = !!routingRule

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<RoutingRuleForm>({
        resolver: zodResolver(createRoutingRuleFormSchema) as any,
        defaultValues: {
            name: "",
            companyId,
            priority: 0,
            conditions: { startTime: "00:00", endTime: "23:59" },
            active: true,
        },
    })

    const weekdays = watch("conditions.weekdays")
    const trunkId = watch("conditions.trunkId")
    const selectedTrunk = trunks.find((t) => t.id === trunkId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: routingRule?.name ?? "",
            companyId,
            priority: routingRule?.priority ?? 0,
            conditions: {
                startTime: "00:00",
                endTime: "23:59",
                ...routingRule?.conditions,
            },
            active: routingRule?.active ?? true,
        })
    }, [open, routingRule, companyId, reset])

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
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? "Editar regra"
                                : "Nova regra de prioridade"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Regra ${routingRule.name}`
                                : "Define QUEUE_PRIO com base em horário/callerId antes do Queue()"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="routing-rule-form"
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

                                <Field>
                                    <FieldLabel>Prioridade</FieldLabel>
                                    <NumberInput
                                        min={0}
                                        max={99}
                                        {...register("priority")}
                                    />
                                    <FieldDescription>
                                        Quando várias regras baterem, vence a de
                                        maior prioridade (0-99)
                                    </FieldDescription>
                                    {errors.priority && (
                                        <FieldError>
                                            {errors.priority.message}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Tronco</FieldLabel>
                                    <Combobox<Trunk>
                                        items={trunks}
                                        value={selectedTrunk}
                                        itemToStringLabel={(t) => t.name}
                                        isItemEqualToValue={(a, b) =>
                                            a.id === b.id
                                        }
                                        onValueChange={(t) =>
                                            setValue(
                                                "conditions.trunkId",
                                                t?.id,
                                                { shouldDirty: true }
                                            )
                                        }
                                    >
                                        <ComboboxInput placeholder="Todos os troncos" />
                                        <ComboboxContent>
                                            <ComboboxEmpty>
                                                {trunks.length === 0
                                                    ? "Nenhum tronco cadastrado para essa empresa"
                                                    : "Nenhum resultado para essa busca"}
                                            </ComboboxEmpty>
                                            <ComboboxList>
                                                {(t: Trunk) => (
                                                    <ComboboxItem
                                                        key={t.id}
                                                        value={t}
                                                    >
                                                        {t.name}
                                                    </ComboboxItem>
                                                )}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
                                    <FieldDescription>
                                        Deixe vazio pra valer em qualquer tronco
                                        da empresa
                                    </FieldDescription>
                                    {errors.conditions?.trunkId && (
                                        <FieldError>
                                            {errors.conditions.trunkId.message}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Dias da semana</FieldLabel>
                                    <WeekdayCheckboxes
                                        value={weekdays ?? []}
                                        onChange={(next: Weekday[]) =>
                                            setValue(
                                                "conditions.weekdays",
                                                next,
                                                { shouldDirty: true }
                                            )
                                        }
                                    />
                                    <FieldDescription>
                                        Vazio = a regra não filtra por dia
                                    </FieldDescription>
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field>
                                        <FieldLabel>Início</FieldLabel>
                                        <InputGroup>
                                            <InputGroupAddon>
                                                <ClockIcon />
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                type="time"
                                                className="[&::-webkit-calendar-picker-indicator]:hidden"
                                                {...register(
                                                    "conditions.startTime"
                                                )}
                                            />
                                        </InputGroup>
                                        {errors.conditions?.startTime && (
                                            <FieldError>
                                                {
                                                    errors.conditions.startTime
                                                        .message
                                                }
                                            </FieldError>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>Fim</FieldLabel>
                                        <InputGroup>
                                            <InputGroupAddon>
                                                <ClockIcon />
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                type="time"
                                                className="[&::-webkit-calendar-picker-indicator]:hidden"
                                                {...register(
                                                    "conditions.endTime"
                                                )}
                                            />
                                        </InputGroup>
                                        {errors.conditions?.endTime && (
                                            <FieldError>
                                                {
                                                    errors.conditions.endTime
                                                        .message
                                                }
                                            </FieldError>
                                        )}
                                    </Field>
                                </div>

                                <Field>
                                    <FieldLabel>
                                        Padrão do CallerID (regex)
                                    </FieldLabel>
                                    <Input
                                        placeholder="Ex: ^1199"
                                        {...register(
                                            "conditions.callerIdPattern"
                                        )}
                                    />
                                    <FieldDescription>
                                        Testado contra o número do chamador
                                    </FieldDescription>
                                    {errors.conditions?.callerIdPattern && (
                                        <FieldError>
                                            {
                                                errors.conditions
                                                    .callerIdPattern.message
                                            }
                                        </FieldError>
                                    )}
                                </Field>

                                <Field orientation="horizontal">
                                    <Controller
                                        control={control}
                                        name="active"
                                        render={({ field }) => (
                                            <Switch
                                                id="active"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                    <FieldLabel htmlFor="active">
                                        Regra ativa
                                    </FieldLabel>
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
                            form="routing-rule-form"
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
                                ? ` na regra "${routingRule.name}"`
                                : " nesta regra"}
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
