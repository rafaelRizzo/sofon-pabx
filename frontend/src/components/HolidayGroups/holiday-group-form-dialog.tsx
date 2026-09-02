"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { PlusIcon, Trash2Icon } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
import { type Company } from "@/hooks/use-companies"
import {
    createHolidayGroupFormSchema,
    type HolidayGroup,
    type HolidayGroupForm,
} from "@/hooks/use-holiday-groups"

const MODES = [
    { value: "manual", label: "Datas manuais" },
    { value: "url", label: "Automático via URL" },
]

const EMPTY_DATE = { name: "", month: 1, day: 1 }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    holidayGroup: HolidayGroup | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `holidayGroup` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: HolidayGroupForm) => Promise<boolean>
    onDelete?: () => void
}

export function HolidayGroupFormDialog({
    open,
    onOpenChange,
    holidayGroup,
    loading = false,
    companies,
    onSave,
    onDelete,
}: Props) {
    const isEdit = !!holidayGroup
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
    } = useForm<HolidayGroupForm>({
        resolver: zodResolver(createHolidayGroupFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            mode: "manual",
            url: "",
            dates: [{ ...EMPTY_DATE }],
        },
    })

    const { fields, append, remove } = useFieldArray({ control, name: "dates" })
    const companyId = watch("companyId")
    const mode = watch("mode")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: holidayGroup?.name ?? "",
            companyId: holidayGroup?.companyId ?? defaultCompanyId,
            mode: holidayGroup?.url ? "url" : "manual",
            url: holidayGroup?.url ?? "",
            dates:
                holidayGroup && holidayGroup.dates.length > 0
                    ? holidayGroup.dates.map((d) => ({
                          name: d.name,
                          month: d.month,
                          day: d.day,
                          year: d.year ?? undefined,
                      }))
                    : [{ ...EMPTY_DATE }],
        })
    }, [open, holidayGroup, reset, defaultCompanyId])

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
                                        ? "Editar grupo de feriados"
                                        : "Novo grupo de feriados"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Grupo ${holidayGroup.name}`
                                        : "Preencha os dados para criar o grupo de feriados"}
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                id="holiday-group-form"
                                onSubmit={onSubmit}
                                className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                            >
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input
                                                placeholder="Ex: feriados-nacionais"
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

                                        <Field>
                                            <FieldLabel>
                                                Origem das datas
                                            </FieldLabel>
                                            <Controller
                                                control={control}
                                                name="mode"
                                                render={({ field }) => (
                                                    <Select
                                                        items={MODES}
                                                        value={field.value}
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {MODES.map((m) => (
                                                                <SelectItem
                                                                    key={
                                                                        m.value
                                                                    }
                                                                    value={
                                                                        m.value
                                                                    }
                                                                >
                                                                    {m.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            <FieldDescription>
                                                Automático via URL busca as
                                                datas periodicamente de um
                                                endpoint externo - nesse modo as
                                                datas não são editáveis aqui.
                                            </FieldDescription>
                                        </Field>

                                        {mode === "url" ? (
                                            <Field>
                                                <FieldLabel>URL</FieldLabel>
                                                <Input
                                                    placeholder="https://..."
                                                    {...register("url")}
                                                />
                                                {errors.url && (
                                                    <FieldError>
                                                        {errors.url.message}
                                                    </FieldError>
                                                )}
                                                <FieldDescription>
                                                    Chamada como{" "}
                                                    <code>
                                                        GET {"{url}"}/{"{ano}"}
                                                    </code>{" "}
                                                    (ex: .../2026). Resposta
                                                    esperada, um item por
                                                    feriado:
                                                </FieldDescription>
                                                <pre className="overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs whitespace-pre">
                                                    {
                                                        '[\n  { "date": "2026-01-01", "name": "Confraternização Universal" }\n]'
                                                    }
                                                </pre>
                                                <FieldDescription>
                                                    Mesmo contrato da{" "}
                                                    <a
                                                        href="https://brasilapi.com.br/docs#tag/Feriados-Nacionais"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline"
                                                    >
                                                        BrasilAPI
                                                    </a>
                                                    , ex:{" "}
                                                    <code>
                                                        https://brasilapi.com.br/api/feriados/v1
                                                    </code>
                                                </FieldDescription>
                                                {isEdit &&
                                                    holidayGroup.dates.length >
                                                        0 && (
                                                        <>
                                                            <FieldDescription>
                                                                Datas atuais
                                                                (geridas
                                                                automaticamente):
                                                            </FieldDescription>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {holidayGroup.dates.map(
                                                                    (d) => (
                                                                        <Badge
                                                                            key={
                                                                                d.id
                                                                            }
                                                                            variant="outline"
                                                                        >
                                                                            {
                                                                                d.name
                                                                            }{" "}
                                                                            (
                                                                            {String(
                                                                                d.day
                                                                            ).padStart(
                                                                                2,
                                                                                "0"
                                                                            )}
                                                                            /
                                                                            {String(
                                                                                d.month
                                                                            ).padStart(
                                                                                2,
                                                                                "0"
                                                                            )}
                                                                            )
                                                                        </Badge>
                                                                    )
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                            </Field>
                                        ) : (
                                            <Field>
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel>
                                                        Datas
                                                    </FieldLabel>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            append({
                                                                ...EMPTY_DATE,
                                                            })
                                                        }
                                                    >
                                                        <PlusIcon />
                                                        Adicionar data
                                                    </Button>
                                                </div>
                                                {errors.dates?.message && (
                                                    <FieldError>
                                                        {errors.dates.message}
                                                    </FieldError>
                                                )}

                                                <div className="flex flex-col gap-3 p-0.5">
                                                    {fields.map(
                                                        (field, index) => (
                                                            <Card
                                                                key={field.id}
                                                            >
                                                                <CardContent className="flex flex-col gap-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-muted-foreground">
                                                                            Data{" "}
                                                                            {index +
                                                                                1}
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
                                                                                remove(
                                                                                    index
                                                                                )
                                                                            }
                                                                        >
                                                                            <Trash2Icon className="size-4" />
                                                                            <span className="sr-only">
                                                                                Remover
                                                                                data
                                                                            </span>
                                                                        </Button>
                                                                    </div>

                                                                    <Field>
                                                                        <FieldLabel>
                                                                            Nome
                                                                        </FieldLabel>
                                                                        <Input
                                                                            placeholder="Ex: Natal"
                                                                            {...register(
                                                                                `dates.${index}.name`
                                                                            )}
                                                                        />
                                                                        {errors
                                                                            .dates?.[
                                                                            index
                                                                        ]
                                                                            ?.name && (
                                                                            <FieldError>
                                                                                {
                                                                                    errors
                                                                                        .dates[
                                                                                        index
                                                                                    ]
                                                                                        ?.name
                                                                                        ?.message
                                                                                }
                                                                            </FieldError>
                                                                        )}
                                                                    </Field>

                                                                    <div className="grid grid-cols-3 gap-3">
                                                                        <Field>
                                                                            <FieldLabel>
                                                                                Mês
                                                                            </FieldLabel>
                                                                            <NumberInput
                                                                                min={
                                                                                    1
                                                                                }
                                                                                max={
                                                                                    12
                                                                                }
                                                                                {...register(
                                                                                    `dates.${index}.month`
                                                                                )}
                                                                            />
                                                                            {errors
                                                                                .dates?.[
                                                                                index
                                                                            ]
                                                                                ?.month && (
                                                                                <FieldError>
                                                                                    {
                                                                                        errors
                                                                                            .dates[
                                                                                            index
                                                                                        ]
                                                                                            ?.month
                                                                                            ?.message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </Field>
                                                                        <Field>
                                                                            <FieldLabel>
                                                                                Dia
                                                                            </FieldLabel>
                                                                            <NumberInput
                                                                                min={
                                                                                    1
                                                                                }
                                                                                max={
                                                                                    31
                                                                                }
                                                                                {...register(
                                                                                    `dates.${index}.day`
                                                                                )}
                                                                            />
                                                                            {errors
                                                                                .dates?.[
                                                                                index
                                                                            ]
                                                                                ?.day && (
                                                                                <FieldError>
                                                                                    {
                                                                                        errors
                                                                                            .dates[
                                                                                            index
                                                                                        ]
                                                                                            ?.day
                                                                                            ?.message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </Field>
                                                                        <Field>
                                                                            <FieldLabel>
                                                                                Ano
                                                                            </FieldLabel>
                                                                            <NumberInput
                                                                                placeholder="Todo ano"
                                                                                min={
                                                                                    1900
                                                                                }
                                                                                max={
                                                                                    2100
                                                                                }
                                                                                {...register(
                                                                                    `dates.${index}.year`
                                                                                )}
                                                                            />
                                                                            {errors
                                                                                .dates?.[
                                                                                index
                                                                            ]
                                                                                ?.year && (
                                                                                <FieldError>
                                                                                    {
                                                                                        errors
                                                                                            .dates[
                                                                                            index
                                                                                        ]
                                                                                            ?.year
                                                                                            ?.message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </Field>
                                                                    </div>
                                                                    <FieldDescription>
                                                                        Deixe
                                                                        "Ano"
                                                                        em
                                                                        branco
                                                                        pra
                                                                        feriado
                                                                        recorrente
                                                                        todo
                                                                        ano.
                                                                        Preencha
                                                                        só se
                                                                        for um
                                                                        feriado
                                                                        móvel
                                                                        (ex:
                                                                        Carnaval),
                                                                        que
                                                                        muda de
                                                                        data a
                                                                        cada
                                                                        ano.
                                                                    </FieldDescription>
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    )}
                                                </div>
                                            </Field>
                                        )}
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
                                    form="holiday-group-form"
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
                                ? ` no grupo "${holidayGroup.name}"`
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
