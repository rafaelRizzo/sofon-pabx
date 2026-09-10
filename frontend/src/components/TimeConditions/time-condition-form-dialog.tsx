"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { TimeGroupsCombobox } from "@/components/TimeConditions/time-groups-combobox"
import { TimeGroupFormDialog } from "@/components/TimeGroups/time-group-form-dialog"
import { type Company } from "@/hooks/use-companies"
import {
    createTimeConditionFormSchema,
    type TimeConditionForm,
} from "@/hooks/use-time-conditions"
import { useTimeGroups } from "@/hooks/use-time-groups"
import { type TimeConditionFormDialogProps } from "@/components/TimeConditions/types"

export function TimeConditionFormDialog({
    open,
    onOpenChange,
    timeCondition,
    loading = false,
    companies,
    onSave,
    onDelete,
}: TimeConditionFormDialogProps) {
    const isEdit = !!timeCondition
    const defaultCompanyId =
        companies.length === 1 ? (companies[0]?.id ?? "") : ""

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
            companyId: defaultCompanyId,
            groupIds: [],
        },
    })

    const companyId = watch("companyId")
    const groupIds = watch("groupIds")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    // Grupos de horário disponíveis pra vincular - dependem da empresa escolhida no próprio form,
    // não do filtro da página (o dialog é independente da empresa que está sendo listada na tabela)
    const { timeGroups, createTimeGroup } = useTimeGroups(companyId || undefined)

    // Criação de grupo de horário sem sair do fluxo (ex: dentro do node "Verificar horário" no
    // Flow) - grupo nasce já vinculado à mesma empresa da condição, sem exigir a página dedicada
    const [createGroupOpen, setCreateGroupOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        reset({
            name: timeCondition?.name ?? "",
            companyId: timeCondition?.companyId ?? defaultCompanyId,
            groupIds:
                timeCondition?.timeGroups.map((tg) => tg.timeGroup.id) ?? [],
        })
    }, [open, timeCondition, reset, defaultCompanyId])

    // Ao trocar de empresa na criação, grupos escolhidos pra empresa anterior não fazem mais
    // sentido (IDs de outra empresa) - reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, {
            shouldValidate: true,
            shouldDirty: true,
        })
        setValue("groupIds", [], { shouldValidate: true, shouldDirty: true })
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
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-lg">
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={2} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit
                                        ? "Editar condição de horário"
                                        : "Nova condição de horário"}
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
                                                    itemToStringLabel={(c) =>
                                                        c.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
                                                    onValueChange={(c) =>
                                                        handleCompanyChange(
                                                            c?.id ?? ""
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

                                        <Field>
                                            <div className="flex items-center justify-between">
                                                <FieldLabel>
                                                    Grupos de horário
                                                </FieldLabel>
                                                {!isEdit && companyId && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setCreateGroupOpen(
                                                                true
                                                            )
                                                        }
                                                    >
                                                        <PlusIcon />
                                                        Novo grupo
                                                    </Button>
                                                )}
                                            </div>
                                            {isEdit ? (
                                                <>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {timeCondition.timeGroups.map(
                                                            ({ timeGroup }) => (
                                                                <Badge
                                                                    key={
                                                                        timeGroup.id
                                                                    }
                                                                    variant="outline"
                                                                >
                                                                    {
                                                                        timeGroup.name
                                                                    }
                                                                </Badge>
                                                            )
                                                        )}
                                                    </div>
                                                    <FieldDescription>
                                                        Os grupos vinculados só
                                                        podem ser definidos na
                                                        criação da condição.
                                                    </FieldDescription>
                                                </>
                                            ) : !companyId ? (
                                                <FieldDescription>
                                                    Selecione uma empresa
                                                    primeiro para ver os grupos
                                                    de horário disponíveis.
                                                </FieldDescription>
                                            ) : (
                                                <>
                                                    <TimeGroupsCombobox
                                                        timeGroups={timeGroups}
                                                        value={groupIds}
                                                        onChange={(v) =>
                                                            setValue(
                                                                "groupIds",
                                                                v,
                                                                {
                                                                    shouldValidate: true,
                                                                    shouldDirty: true,
                                                                }
                                                            )
                                                        }
                                                    />
                                                    {errors.groupIds && (
                                                        <FieldError>
                                                            {
                                                                errors.groupIds
                                                                    .message
                                                            }
                                                        </FieldError>
                                                    )}
                                                </>
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
                                    form="time-condition-form"
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
                                ? ` na condição "${timeCondition.name}"`
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

            {selectedCompany && (
                <TimeGroupFormDialog
                    open={createGroupOpen}
                    onOpenChange={setCreateGroupOpen}
                    timeGroup={null}
                    companies={[selectedCompany]}
                    onSave={async (form) => {
                        const groupId = await createTimeGroup(form, true)
                        if (!groupId) return false
                        setValue("groupIds", [...groupIds, groupId], {
                            shouldValidate: true,
                            shouldDirty: true,
                        })
                        return true
                    }}
                />
            )}
        </>
    )
}
