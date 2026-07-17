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
import { NumberInput } from "@/components/ui/number-input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { RouteDestinationField } from "@/components/RouteDestination/route-destination-field"
import { type Audio, useAudios } from "@/hooks/use-audios"
import { type Company } from "@/hooks/use-companies"
import {
    createIvrMenuFormSchema,
    IVR_MENU_TYPES,
    type IvrMenu,
    type IvrMenuForm,
    type IvrMenuType,
} from "@/hooks/use-ivr"

const DIGIT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
    value: String(i),
    label: String(i),
}))

const emptyOption = { digit: "0", destination: { type: "hangup" as const } }

const TYPE_ITEMS = [
    { value: "menu", label: "Menu (tecla única)" },
    { value: "collect", label: "Coleta de dígitos (CPF/CNPJ)" },
]

// Presets rápidos pro modo "coleta": só preenchem maxDigits, mesmo padrão visual dos presets
// de padrão de discagem em OutboundRouteFormDialog
const DIGIT_COUNT_PRESETS = [
    { label: "CPF (11 dígitos)", digits: 11 },
    { label: "CNPJ (14 dígitos)", digits: 14 },
]

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    ivrMenu: IvrMenu | null
    companies: Company[]
    onSave: (form: IvrMenuForm) => Promise<boolean>
}

export function IvrMenuFormDialog({
    open,
    onOpenChange,
    ivrMenu,
    companies,
    onSave,
}: Props) {
    const isEdit = !!ivrMenu

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<IvrMenuForm>({
        resolver: zodResolver(createIvrMenuFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: "",
            type: "menu",
            variableName: null,
            audioId: null,
            maxDigits: 1,
            digitTimeout: 5,
            invalidRetries: 3,
            invalidDestination: { type: "hangup" },
            timeoutRetries: 3,
            timeoutDestination: { type: "hangup" },
            longDestination: { type: "hangup" },
            options: [],
        },
    })

    const optionFields = useFieldArray({ control, name: "options" })

    const companyId = watch("companyId")
    const type = watch("type")
    const variableName = watch("variableName")
    const audioId = watch("audioId")
    const invalidDestination = watch("invalidDestination")
    const timeoutDestination = watch("timeoutDestination")
    const longDestination = watch("longDestination")
    const options = watch("options")
    const isCollect = type === "collect"

    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    // Áudio do menu depende da empresa do próprio form, não do filtro da página
    const { audios } = useAudios(companyId || undefined)
    const selectedAudio = audios.find((a) => a.id === audioId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: ivrMenu?.name ?? "",
            companyId: ivrMenu?.companyId ?? "",
            type: ivrMenu?.type ?? "menu",
            variableName: ivrMenu?.variableName ?? null,
            audioId: ivrMenu?.audioId ?? null,
            maxDigits: ivrMenu?.maxDigits ?? 1,
            digitTimeout: ivrMenu?.digitTimeout ?? 5,
            invalidRetries: ivrMenu?.invalidRetries ?? 3,
            invalidDestination: ivrMenu?.invalidDestination ?? {
                type: "hangup",
            },
            timeoutRetries: ivrMenu?.timeoutRetries ?? 3,
            timeoutDestination: ivrMenu?.timeoutDestination ?? {
                type: "hangup",
            },
            longDestination: ivrMenu?.longDestination ?? { type: "hangup" },
            options:
                ivrMenu?.options.map((o) => ({
                    digit: o.digit,
                    destination: o.destination,
                })) ?? [],
        })
    }, [open, ivrMenu, reset])

    // Ao trocar de empresa na criação, áudio/destinos escolhidos pra empresa anterior não fazem
    // mais sentido (IDs de outra empresa): reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, {
            shouldValidate: true,
            shouldDirty: true,
        })
        setValue("audioId", null, { shouldDirty: true })
        setValue(
            "invalidDestination",
            { type: "hangup" },
            { shouldDirty: true }
        )
        setValue(
            "timeoutDestination",
            { type: "hangup" },
            { shouldDirty: true }
        )
        setValue("longDestination", { type: "hangup" }, { shouldDirty: true })
        setValue("options", [], { shouldDirty: true })
    }

    // Ao trocar de tipo, os campos exclusivos de cada modo não fazem mais sentido: "menu" não
    // usa variableName, "collect" não usa opções de tecla e precisa de pelo menos 2 dígitos
    function handleTypeChange(nextType: IvrMenuType) {
        setValue("type", nextType, { shouldValidate: true, shouldDirty: true })
        if (nextType === "collect") {
            setValue("options", [], { shouldDirty: true })
            setValue("maxDigits", 11, {
                shouldValidate: true,
                shouldDirty: true,
            })
        } else {
            setValue("variableName", null, {
                shouldValidate: true,
                shouldDirty: true,
            })
            setValue("maxDigits", 1, {
                shouldValidate: true,
                shouldDirty: true,
            })
        }
    }

    // Um aviso por linha quando o dígito escolhido se repete em outra opção do próprio form
    const digitConflicts = options.map((o, index) =>
        options.some((other, i) => i !== index && other.digit === o.digit)
    )
    const hasDigitConflict = digitConflicts.some(Boolean)

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
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Editar menu de URA" : "Novo menu de URA"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Menu ${ivrMenu.name}`
                                : "Preencha os dados para criar o menu de URA"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="ivr-menu-form"
                        onSubmit={onSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: Menu Principal"
                                        maxLength={80}
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <FieldError>
                                            {errors.name.message}
                                        </FieldError>
                                    )}
                                </Field>

                                {!isEdit && (
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
                                                handleCompanyChange(c?.id ?? "")
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
                                    <FieldLabel>Tipo de URA</FieldLabel>
                                    <Select
                                        items={TYPE_ITEMS}
                                        value={type}
                                        onValueChange={(v) =>
                                            handleTypeChange(
                                                (v ?? "menu") as IvrMenuType
                                            )
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IVR_MENU_TYPES.map((t) => (
                                                <SelectItem key={t} value={t}>
                                                    {
                                                        TYPE_ITEMS.find(
                                                            (i) => i.value === t
                                                        )?.label
                                                    }
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        {isCollect
                                            ? "Espera uma sequência fixa de dígitos (ex: CPF/CNPJ) e segue direto pro destino, sem opções de tecla."
                                            : "Cada tecla digitada (0-9) pode ter um destino próprio."}
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel>Áudio</FieldLabel>
                                    {!companyId ? (
                                        <FieldDescription>
                                            Selecione uma empresa primeiro para
                                            ver os áudios disponíveis.
                                        </FieldDescription>
                                    ) : (
                                        <Combobox<Audio>
                                            items={audios}
                                            value={selectedAudio}
                                            itemToStringLabel={(a) => a.name}
                                            isItemEqualToValue={(a, b) =>
                                                a.id === b.id
                                            }
                                            onValueChange={(a) =>
                                                setValue(
                                                    "audioId",
                                                    a?.id ?? null,
                                                    { shouldDirty: true }
                                                )
                                            }
                                        >
                                            <ComboboxInput placeholder="Buscar áudio..." />
                                            <ComboboxContent>
                                                <ComboboxEmpty>
                                                    Nenhum áudio cadastrado para
                                                    essa empresa
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(a: Audio) => (
                                                        <ComboboxItem
                                                            key={a.id}
                                                            value={a}
                                                        >
                                                            {a.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    )}
                                    <FieldDescription>
                                        Sem áudio vinculado, o menu fica sem
                                        dialplan até um ser enviado (em Áudios)
                                        e selecionado aqui.
                                    </FieldDescription>
                                </Field>

                                {isCollect && (
                                    <Field>
                                        <FieldLabel>
                                            Nome da variável
                                        </FieldLabel>
                                        <Input
                                            placeholder="Ex: CPF_CLIENTE"
                                            maxLength={80}
                                            value={variableName ?? ""}
                                            onChange={(e) =>
                                                setValue(
                                                    "variableName",
                                                    e.target.value || null,
                                                    {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    }
                                                )
                                            }
                                        />
                                        {errors.variableName && (
                                            <FieldError>
                                                {errors.variableName.message}
                                            </FieldError>
                                        )}
                                        <FieldDescription>
                                            Guarda o que o cliente digitou
                                            aqui, dá pra usar depois em outro
                                            passo do fluxo (ex: um Request
                                            Template que consulta o CPF/CNPJ
                                            num sistema externo, ou uma
                                            Validar Variável que confere se o
                                            número é válido antes de seguir).
                                        </FieldDescription>
                                    </Field>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <Field className="col-span-2">
                                        <FieldLabel>
                                            {isCollect
                                                ? "Quantidade de dígitos"
                                                : "Máximo de dígitos"}
                                        </FieldLabel>
                                        {isCollect && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {DIGIT_COUNT_PRESETS.map(
                                                    (preset) => (
                                                        <Badge
                                                            key={preset.label}
                                                            variant="outline"
                                                            className="cursor-pointer hover:bg-accent"
                                                            onClick={() =>
                                                                setValue(
                                                                    "maxDigits",
                                                                    preset.digits,
                                                                    {
                                                                        shouldValidate: true,
                                                                        shouldDirty: true,
                                                                    }
                                                                )
                                                            }
                                                        >
                                                            <PlusIcon />
                                                            {preset.label}
                                                        </Badge>
                                                    )
                                                )}
                                            </div>
                                        )}
                                        <NumberInput
                                            placeholder="1"
                                            min={1}
                                            max={20}
                                            {...register("maxDigits")}
                                        />
                                        {errors.maxDigits && (
                                            <FieldError>
                                                {errors.maxDigits.message}
                                            </FieldError>
                                        )}
                                        {isCollect ? (
                                            <FieldDescription>
                                                Use o maior tamanho possível
                                                (ex: 14, do CNPJ): se o
                                                cliente digitar só o CPF (11)
                                                e parar, a URA aceita normal:
                                                ela para de esperar assim que
                                                ele pausa, não precisa bater
                                                o número exato.
                                            </FieldDescription>
                                        ) : (
                                            <FieldDescription>
                                                &gt;1 permite sequência longa
                                                (ex: CPF) via destino de
                                                sequência.
                                            </FieldDescription>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>
                                            Timeout de dígito (s)
                                        </FieldLabel>
                                        <NumberInput
                                            placeholder="5"
                                            min={1}
                                            max={60}
                                            {...register("digitTimeout")}
                                        />
                                        {errors.digitTimeout && (
                                            <FieldError>
                                                {errors.digitTimeout.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>
                                            Tentativas inválidas
                                        </FieldLabel>
                                        <NumberInput
                                            placeholder="3"
                                            min={0}
                                            max={10}
                                            {...register("invalidRetries")}
                                        />
                                        {errors.invalidRetries && (
                                            <FieldError>
                                                {errors.invalidRetries.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>
                                            Tentativas de timeout
                                        </FieldLabel>
                                        <NumberInput
                                            placeholder="3"
                                            min={0}
                                            max={10}
                                            {...register("timeoutRetries")}
                                        />
                                        {errors.timeoutRetries && (
                                            <FieldError>
                                                {errors.timeoutRetries.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                </div>

                                <Field>
                                    <FieldLabel>
                                        {isCollect
                                            ? "Destino em entrada incompleta"
                                            : "Destino em dígito inválido"}
                                    </FieldLabel>
                                    <RouteDestinationField
                                        value={invalidDestination}
                                        onChange={(d) =>
                                            setValue("invalidDestination", d, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        {isCollect
                                            ? "Para onde a chamada vai após esgotar as tentativas com uma sequência de dígitos que não completa a quantidade esperada."
                                            : "Para onde a chamada vai após esgotar as tentativas com dígito inválido."}
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel>Destino em timeout</FieldLabel>
                                    <RouteDestinationField
                                        value={timeoutDestination}
                                        onChange={(d) =>
                                            setValue("timeoutDestination", d, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada vai após esgotar as
                                        tentativas sem nenhuma entrada.
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel>
                                        {isCollect
                                            ? "Destino após coletar os dígitos"
                                            : "Destino de sequência longa"}
                                    </FieldLabel>
                                    <RouteDestinationField
                                        value={longDestination}
                                        onChange={(d) =>
                                            setValue("longDestination", d, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        {isCollect
                                            ? "Para onde a chamada segue assim que a quantidade de dígitos configurada acima é coletada."
                                            : "Para onde vai quando o chamador digita mais de 1 dígito (até o máximo) sem bater com nenhuma opção abaixo, ex: consulta por CPF."}
                                    </FieldDescription>
                                </Field>

                                {!isCollect && (
                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel>
                                                Opções de dígito
                                            </FieldLabel>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    !companyId ||
                                                    optionFields.fields
                                                        .length >= 10
                                                }
                                                onClick={() =>
                                                    optionFields.append(
                                                        emptyOption,
                                                        { shouldFocus: false }
                                                    )
                                                }
                                            >
                                                <PlusIcon />
                                                Adicionar
                                            </Button>
                                        </div>
                                        {!companyId ? (
                                            <FieldDescription>
                                                Selecione uma empresa primeiro
                                                para configurar as opções de
                                                dígito.
                                            </FieldDescription>
                                        ) : (
                                            <>
                                                <FieldDescription>
                                                    Para onde a chamada é
                                                    direcionada quando o
                                                    chamador digita cada tecla
                                                    (máximo 10 opções, um dígito
                                                    por opção).
                                                </FieldDescription>
                                                {errors.options?.root && (
                                                    <FieldError>
                                                        {
                                                            errors.options.root
                                                                .message
                                                        }
                                                    </FieldError>
                                                )}
                                                <div className="space-y-2">
                                                    {optionFields.fields
                                                        .length === 0 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Nenhuma opção de
                                                            dígito adicionada.
                                                        </p>
                                                    )}
                                                    {optionFields.fields.map(
                                                        (field, index) => (
                                                            <div
                                                                key={field.id}
                                                                className="space-y-2 rounded-md border p-2"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <div className="w-20 shrink-0">
                                                                        <Select
                                                                            items={
                                                                                DIGIT_OPTIONS
                                                                            }
                                                                            value={
                                                                                options[
                                                                                    index
                                                                                ]
                                                                                    ?.digit
                                                                            }
                                                                            onValueChange={(
                                                                                v
                                                                            ) =>
                                                                                setValue(
                                                                                    `options.${index}.digit`,
                                                                                    v ??
                                                                                        "0",
                                                                                    {
                                                                                        shouldValidate: true,
                                                                                        shouldDirty: true,
                                                                                    }
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="w-full">
                                                                                <SelectValue placeholder="Dígito" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {DIGIT_OPTIONS.map(
                                                                                    (
                                                                                        d
                                                                                    ) => (
                                                                                        <SelectItem
                                                                                            key={
                                                                                                d.value
                                                                                            }
                                                                                            value={
                                                                                                d.value
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                d.label
                                                                                            }
                                                                                        </SelectItem>
                                                                                    )
                                                                                )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <RouteDestinationField
                                                                            value={
                                                                                options[
                                                                                    index
                                                                                ]
                                                                                    ?.destination
                                                                            }
                                                                            onChange={(
                                                                                d
                                                                            ) =>
                                                                                setValue(
                                                                                    `options.${index}.destination`,
                                                                                    d,
                                                                                    {
                                                                                        shouldValidate: true,
                                                                                        shouldDirty: true,
                                                                                    }
                                                                                )
                                                                            }
                                                                            companyId={
                                                                                companyId
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() =>
                                                                            optionFields.remove(
                                                                                index
                                                                            )
                                                                        }
                                                                    >
                                                                        <XIcon />
                                                                        <span className="sr-only">
                                                                            Remover
                                                                            opção
                                                                        </span>
                                                                    </Button>
                                                                </div>
                                                                {digitConflicts[
                                                                    index
                                                                ] && (
                                                                    <FieldError>
                                                                        Dígito
                                                                        duplicado
                                                                        com
                                                                        outra
                                                                        opção
                                                                        deste
                                                                        formulário
                                                                    </FieldError>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </Field>
                                )}
                            </FieldGroup>
                        </div>
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
                            form="ivr-menu-form"
                            disabled={isSubmitting || hasDigitConflict}
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
                                ? ` no menu "${ivrMenu.name}"`
                                : " neste menu"}
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
