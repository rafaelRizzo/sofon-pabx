"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { InfoIcon } from "lucide-react"
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
import { EntityFormDialogSkeletonContent } from "@/components/entity-form-dialog-skeleton"
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
import { Switch } from "@/components/ui/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { type Audio, useAudios } from "@/hooks/use-audios"
import { type Company } from "@/hooks/use-companies"
import {
    createQueueFormSchema,
    QUEUE_STRATEGIES,
    QUEUE_STRATEGY_DESCRIPTIONS,
    QUEUE_STRATEGY_LABELS,
    type Queue,
    type QueueForm,
} from "@/hooks/use-queues"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    queue: Queue | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) — nesse caso
    // `queue` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: QueueForm) => Promise<boolean>
    onDelete?: () => void
    // abre o QueueMembersSheet — só passado por quem tem acesso à fila fora do fluxo normal da
    // página de filas (ex: EditNodeDialog, que edita a fila a partir do canvas de Flows e não tem
    // outro jeito de chegar no gerenciador de membros)
    onManageMembers?: () => void
}

export function QueueFormDialog({
    open,
    onOpenChange,
    queue,
    loading = false,
    companies,
    onSave,
    onDelete,
    onManageMembers,
}: Props) {
    const isEdit = !!queue
    const defaultCompanyId =
        companies.length === 1 ? (companies[0]?.id ?? "") : ""

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<QueueForm>({
        resolver: zodResolver(createQueueFormSchema) as any,
        defaultValues: {
            name: "",
            companyId: defaultCompanyId,
            number: "",
            strategy: "ringall",
            musicOnHold: "default",
            timeout: 15,
            retry: 5,
            maxLen: 0,
            wrapupTime: 5,
            announce: null,
            announceFrequency: 0,
            announcePosition: false,
            periodicAnnounce: null,
            periodicAnnounceFrequency: 60,
            agentAnnounce: null,
            joinEmpty: true,
            leaveWhenEmpty: false,
            weight: 0,
            surveyAudioId: null,
            callcenterEnabled: false,
        },
    })

    const companyId = watch("companyId")
    const announce = watch("announce")
    const announcePosition = watch("announcePosition")
    const periodicAnnounce = watch("periodicAnnounce")
    const agentAnnounce = watch("agentAnnounce")
    const surveyAudioId = watch("surveyAudioId")
    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    // Anúncios referenciam um Audio já cadastrado pra essa empresa — depende do companyId do
    // form, não do filtro da página (mesmo padrão do RouteDestinationField)
    const { audios } = useAudios(companyId)
    const selectedAnnounce = audios.find((a) => a.id === announce) ?? null
    const selectedPeriodicAnnounce =
        audios.find((a) => a.id === periodicAnnounce) ?? null
    const selectedAgentAnnounce =
        audios.find((a) => a.id === agentAnnounce) ?? null
    const selectedSurveyAudio =
        audios.find((a) => a.id === surveyAudioId) ?? null

    useEffect(() => {
        if (!open) return
        reset({
            name: queue?.name ?? "",
            companyId: queue?.companyId ?? defaultCompanyId,
            number: queue?.number ?? "",
            strategy: queue?.strategy ?? "ringall",
            musicOnHold: "default",
            timeout: queue?.timeout ?? 15,
            retry: queue?.retry ?? 5,
            maxLen: queue?.maxLen ?? 0,
            wrapupTime: queue?.wrapupTime ?? 5,
            announce: queue?.announce ?? null,
            announceFrequency: queue?.announceFrequency ?? 0,
            announcePosition: queue?.announcePosition ?? false,
            periodicAnnounce: queue?.periodicAnnounce ?? null,
            periodicAnnounceFrequency: queue?.periodicAnnounceFrequency ?? 60,
            agentAnnounce: queue?.agentAnnounce ?? null,
            joinEmpty: queue?.joinEmpty ?? true,
            leaveWhenEmpty: queue?.leaveWhenEmpty ?? false,
            weight: queue?.weight ?? 0,
            surveyAudioId: queue?.surveyAudioId ?? null,
            callcenterEnabled: queue?.callcenterEnabled ?? false,
        })
    }, [open, queue, reset, defaultCompanyId])

    // Ao trocar de empresa na criação, destino/música/anúncios escolhidos pra empresa anterior não
    // fazem mais sentido (IDs de outra empresa) — reseta pra evitar enviar referências inválidas
    function handleCompanyChange(nextCompanyId: string) {
        setValue("companyId", nextCompanyId, {
            shouldValidate: true,
            shouldDirty: true,
        })
        setValue("announce", null, { shouldDirty: true })
        setValue("periodicAnnounce", null, { shouldDirty: true })
        setValue("agentAnnounce", null, { shouldDirty: true })
        setValue("surveyAudioId", null, { shouldDirty: true })
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
                    {loading ? (
                        <EntityFormDialogSkeletonContent fieldCount={6} />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {isEdit ? "Editar fila" : "Nova fila"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEdit
                                        ? `Fila ${queue.name}`
                                        : "Preencha os dados para criar a fila"}
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                id="queue-form"
                                onSubmit={onSubmit}
                                className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                            >
                                <ScrollArea className="min-h-0">
                                    <FieldGroup className="pr-3">
                                        <Field>
                                            <FieldLabel>Nome</FieldLabel>
                                            <Input
                                                placeholder="Ex: suporte"
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

                                        <div className="grid grid-cols-2 gap-3">
                                            <Field>
                                                <FieldLabel>Número</FieldLabel>
                                                <Input
                                                    placeholder="Ex: 8000"
                                                    {...register("number")}
                                                />
                                                {errors.number && (
                                                    <FieldError>
                                                        {errors.number.message}
                                                    </FieldError>
                                                )}
                                            </Field>

                                            <Field>
                                                {/* div em vez de FieldLabel: um <button> dentro de <label> herda o
                                        clique implícito do label, o que reabriria/fecharia o tooltip ao
                                        clicar no texto "Estratégia" */}
                                                <div className="flex items-center gap-2 text-xs/relaxed leading-snug font-medium">
                                                    Estratégia
                                                    <Tooltip>
                                                        <TooltipTrigger
                                                            render={
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex text-muted-foreground hover:text-foreground"
                                                                />
                                                            }
                                                        >
                                                            <InfoIcon className="size-3" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right">
                                                            <ul className="flex list-none flex-col gap-1 text-left">
                                                                {QUEUE_STRATEGIES.map(
                                                                    (s) => (
                                                                        <li
                                                                            key={
                                                                                s
                                                                            }
                                                                        >
                                                                            <strong>
                                                                                {
                                                                                    QUEUE_STRATEGY_LABELS[
                                                                                        s
                                                                                    ]
                                                                                }

                                                                                :
                                                                            </strong>{" "}
                                                                            {
                                                                                QUEUE_STRATEGY_DESCRIPTIONS[
                                                                                    s
                                                                                ]
                                                                            }
                                                                        </li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Controller
                                                    control={control}
                                                    name="strategy"
                                                    render={({ field }) => (
                                                        <Select
                                                            items={QUEUE_STRATEGIES.map(
                                                                (s) => ({
                                                                    value: s,
                                                                    label: QUEUE_STRATEGY_LABELS[
                                                                        s
                                                                    ],
                                                                })
                                                            )}
                                                            value={field.value}
                                                            onValueChange={
                                                                field.onChange
                                                            }
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {QUEUE_STRATEGIES.map(
                                                                    (s) => (
                                                                        <SelectItem
                                                                            key={
                                                                                s
                                                                            }
                                                                            value={
                                                                                s
                                                                            }
                                                                        >
                                                                            {
                                                                                QUEUE_STRATEGY_LABELS[
                                                                                    s
                                                                                ]
                                                                            }
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Field>
                                                <FieldLabel>
                                                    Timeout (s)
                                                </FieldLabel>
                                                <NumberInput
                                                    {...register("timeout")}
                                                />
                                                {errors.timeout && (
                                                    <FieldError>
                                                        {errors.timeout.message}
                                                    </FieldError>
                                                )}
                                            </Field>
                                            <Field>
                                                <FieldLabel>
                                                    Retry (s)
                                                </FieldLabel>
                                                <NumberInput
                                                    {...register("retry")}
                                                />
                                                {errors.retry && (
                                                    <FieldError>
                                                        {errors.retry.message}
                                                    </FieldError>
                                                )}
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Field>
                                                <FieldLabel>
                                                    Tamanho máximo
                                                </FieldLabel>
                                                <NumberInput
                                                    {...register("maxLen")}
                                                />
                                                <FieldDescription>
                                                    0 = sem limite de chamadas
                                                    na fila
                                                </FieldDescription>
                                                {errors.maxLen && (
                                                    <FieldError>
                                                        {errors.maxLen.message}
                                                    </FieldError>
                                                )}
                                            </Field>
                                            <Field>
                                                <FieldLabel>
                                                    Wrapup (s)
                                                </FieldLabel>
                                                <NumberInput
                                                    {...register("wrapupTime")}
                                                />
                                                <FieldDescription>
                                                    Pausa do agente após atender
                                                </FieldDescription>
                                                {errors.wrapupTime && (
                                                    <FieldError>
                                                        {
                                                            errors.wrapupTime
                                                                .message
                                                        }
                                                    </FieldError>
                                                )}
                                            </Field>
                                        </div>

                                        <Field>
                                            <FieldLabel>
                                                Anúncio ao entrar na fila
                                            </FieldLabel>
                                            {!companyId ? (
                                                <FieldDescription>
                                                    Selecione uma empresa
                                                    primeiro.
                                                </FieldDescription>
                                            ) : (
                                                <Combobox<Audio>
                                                    items={audios}
                                                    value={selectedAnnounce}
                                                    itemToStringLabel={(a) =>
                                                        a.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
                                                    onValueChange={(a) =>
                                                        setValue(
                                                            "announce",
                                                            a?.id ?? null,
                                                            {
                                                                shouldDirty: true,
                                                            }
                                                        )
                                                    }
                                                >
                                                    <ComboboxInput placeholder="Nenhum" />
                                                    <ComboboxContent>
                                                        <ComboboxEmpty>
                                                            {audios.length === 0
                                                                ? "Nenhum áudio cadastrado para essa empresa"
                                                                : "Nenhum resultado para essa busca"}
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
                                                Tocado uma única vez pro
                                                cliente, ao entrar na fila
                                                (antes da música de espera).
                                            </FieldDescription>
                                            {errors.announce && (
                                                <FieldError>
                                                    {errors.announce.message}
                                                </FieldError>
                                            )}
                                        </Field>

                                        <Field orientation="horizontal">
                                            <FieldLabel htmlFor="announcePosition">
                                                Anunciar posição na fila
                                            </FieldLabel>
                                            <Controller
                                                control={control}
                                                name="announcePosition"
                                                render={({ field }) => (
                                                    <Switch
                                                        id="announcePosition"
                                                        checked={field.value}
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                    />
                                                )}
                                            />
                                        </Field>
                                        <Field>
                                            <FieldLabel>
                                                Intervalo (s)
                                            </FieldLabel>
                                            <NumberInput
                                                disabled={!announcePosition}
                                                {...register(
                                                    "announceFrequency"
                                                )}
                                            />
                                            <FieldDescription>
                                                Tempo entre os anúncios de
                                                posição/espera
                                            </FieldDescription>
                                            {errors.announceFrequency && (
                                                <FieldError>
                                                    {
                                                        errors.announceFrequency
                                                            .message
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Field>
                                                <FieldLabel>
                                                    Anúncio periódico
                                                </FieldLabel>
                                                {!companyId ? (
                                                    <FieldDescription>
                                                        Selecione uma empresa
                                                        primeiro.
                                                    </FieldDescription>
                                                ) : (
                                                    <Combobox<Audio>
                                                        items={audios}
                                                        value={
                                                            selectedPeriodicAnnounce
                                                        }
                                                        itemToStringLabel={(
                                                            a
                                                        ) => a.name}
                                                        isItemEqualToValue={(
                                                            a,
                                                            b
                                                        ) => a.id === b.id}
                                                        onValueChange={(a) =>
                                                            setValue(
                                                                "periodicAnnounce",
                                                                a?.id ?? null,
                                                                {
                                                                    shouldDirty: true,
                                                                }
                                                            )
                                                        }
                                                    >
                                                        <ComboboxInput placeholder="Nenhum" />
                                                        <ComboboxContent>
                                                            <ComboboxEmpty>
                                                                {audios.length ===
                                                                0
                                                                    ? "Nenhum áudio cadastrado para essa empresa"
                                                                    : "Nenhum resultado para essa busca"}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(a: Audio) => (
                                                                    <ComboboxItem
                                                                        key={
                                                                            a.id
                                                                        }
                                                                        value={
                                                                            a
                                                                        }
                                                                    >
                                                                        {a.name}
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                )}
                                                {errors.periodicAnnounce && (
                                                    <FieldError>
                                                        {
                                                            errors
                                                                .periodicAnnounce
                                                                .message
                                                        }
                                                    </FieldError>
                                                )}
                                            </Field>
                                            <Field>
                                                <FieldLabel>
                                                    Frequência (s)
                                                </FieldLabel>
                                                <NumberInput
                                                    {...register(
                                                        "periodicAnnounceFrequency"
                                                    )}
                                                />
                                                <FieldDescription>
                                                    Repete durante a espera
                                                </FieldDescription>
                                                {errors.periodicAnnounceFrequency && (
                                                    <FieldError>
                                                        {
                                                            errors
                                                                .periodicAnnounceFrequency
                                                                .message
                                                        }
                                                    </FieldError>
                                                )}
                                            </Field>
                                        </div>

                                        <Field>
                                            <FieldLabel>
                                                Anúncio pro atendente
                                            </FieldLabel>
                                            {!companyId ? (
                                                <FieldDescription>
                                                    Selecione uma empresa
                                                    primeiro.
                                                </FieldDescription>
                                            ) : (
                                                <Combobox<Audio>
                                                    items={audios}
                                                    value={
                                                        selectedAgentAnnounce
                                                    }
                                                    itemToStringLabel={(a) =>
                                                        a.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
                                                    onValueChange={(a) =>
                                                        setValue(
                                                            "agentAnnounce",
                                                            a?.id ?? null,
                                                            {
                                                                shouldDirty: true,
                                                            }
                                                        )
                                                    }
                                                >
                                                    <ComboboxInput placeholder="Nenhum" />
                                                    <ComboboxContent>
                                                        <ComboboxEmpty>
                                                            {audios.length === 0
                                                                ? "Nenhum áudio cadastrado para essa empresa"
                                                                : "Nenhum resultado para essa busca"}
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
                                                Tocado só pro atendente, bem
                                                antes de a ligação ser conectada
                                                a ele. O cliente não ouve isso.
                                            </FieldDescription>
                                            {errors.agentAnnounce && (
                                                <FieldError>
                                                    {
                                                        errors.agentAnnounce
                                                            .message
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="flex items-center gap-2">
                                                <Controller
                                                    control={control}
                                                    name="joinEmpty"
                                                    render={({ field }) => (
                                                        <Switch
                                                            id="joinEmpty"
                                                            checked={
                                                                field.value
                                                            }
                                                            onCheckedChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    )}
                                                />
                                                <FieldLabel htmlFor="joinEmpty">
                                                    Entrar com fila vazia
                                                </FieldLabel>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Controller
                                                    control={control}
                                                    name="leaveWhenEmpty"
                                                    render={({ field }) => (
                                                        <Switch
                                                            id="leaveWhenEmpty"
                                                            checked={
                                                                field.value
                                                            }
                                                            onCheckedChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    )}
                                                />
                                                <FieldLabel htmlFor="leaveWhenEmpty">
                                                    Sair se ficar vazia
                                                </FieldLabel>
                                            </div>
                                        </div>

                                        <Field>
                                            <FieldLabel>Peso</FieldLabel>
                                            <NumberInput
                                                {...register("weight")}
                                            />
                                            <FieldDescription>
                                                Usado para priorizar essa fila
                                                quando o agente está em várias
                                            </FieldDescription>
                                            {errors.weight && (
                                                <FieldError>
                                                    {errors.weight.message}
                                                </FieldError>
                                            )}
                                        </Field>

                                        <Field orientation="horizontal">
                                            <div className="flex items-center gap-2 text-xs/relaxed leading-snug font-medium">
                                                <FieldLabel htmlFor="callcenterEnabled">
                                                    Módulo Callcenter
                                                </FieldLabel>
                                                <Tooltip>
                                                    <TooltipTrigger
                                                        render={
                                                            <button
                                                                type="button"
                                                                className="inline-flex text-muted-foreground hover:text-foreground"
                                                            />
                                                        }
                                                    >
                                                        <InfoIcon className="size-3" />
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="right"
                                                        className="max-w-64"
                                                    >
                                                        Liga, só nessa fila,
                                                        prioridade dinâmica por
                                                        regra e roteamento por
                                                        afinidade (nota de
                                                        atendimento). As regras
                                                        de prioridade e as notas
                                                        são configuradas por
                                                        empresa em Callcenter.
                                                        Desligado = fila 100%
                                                        nativa.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Controller
                                                control={control}
                                                name="callcenterEnabled"
                                                render={({ field }) => (
                                                    <Switch
                                                        id="callcenterEnabled"
                                                        checked={field.value}
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                    />
                                                )}
                                            />
                                        </Field>

                                        <Field>
                                            <FieldLabel>
                                                Pesquisa de satisfação
                                            </FieldLabel>
                                            {!companyId ? (
                                                <FieldDescription>
                                                    Selecione uma empresa
                                                    primeiro.
                                                </FieldDescription>
                                            ) : (
                                                <Combobox<Audio>
                                                    items={audios}
                                                    value={selectedSurveyAudio}
                                                    itemToStringLabel={(a) =>
                                                        a.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
                                                    onValueChange={(a) =>
                                                        setValue(
                                                            "surveyAudioId",
                                                            a?.id ?? null,
                                                            {
                                                                shouldDirty: true,
                                                            }
                                                        )
                                                    }
                                                >
                                                    <ComboboxInput placeholder="Nenhuma (desligada)" />
                                                    <ComboboxContent>
                                                        <ComboboxEmpty>
                                                            {audios.length === 0
                                                                ? "Nenhum áudio cadastrado para essa empresa"
                                                                : "Nenhum resultado para essa busca"}
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
                                                Áudio que pede uma nota de 1 a 5
                                                ao cliente após o atendimento.
                                                Deixe vazio para não fazer
                                                pesquisa nessa fila.
                                            </FieldDescription>
                                            {errors.surveyAudioId && (
                                                <FieldError>
                                                    {
                                                        errors.surveyAudioId
                                                            .message
                                                    }
                                                </FieldError>
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
                                {isEdit && onManageMembers && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={
                                            onDelete ? undefined : "mr-auto"
                                        }
                                        onClick={onManageMembers}
                                    >
                                        Gerenciar membros
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
                                    form="queue-form"
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
                                ? ` na fila "${queue.name}"`
                                : " nesta fila"}
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
