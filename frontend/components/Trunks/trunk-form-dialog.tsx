"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { CodecCheckboxes } from "@/components/codec-checkboxes"
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
import { Switch } from "@/components/ui/switch"
import { type Company } from "@/hooks/use-companies"
import {
    createTrunkSchema,
    updateTrunkSchema,
    type RegistrationMode,
    type Trunk,
    type TrunkCreateForm,
    type TrunkType,
    type TrunkUpdateForm,
} from "@/hooks/use-trunks"

const REGISTRATION_MODES = [
    { value: "outbound", label: "Outbound (registra no provedor)" },
    { value: "inbound", label: "Inbound (recebe registro)" },
    { value: "custom", label: "Custom (Goto pro seu contexto)" },
]

const TRUNK_TYPES = [
    { value: "pjsip", label: "PJSIP" },
    { value: "iax", label: "IAX2" },
]

// Sentinela pra representar "não definido" em selects opcionais — base-ui não aceita value=""
const UNSET = "__unset__"

const TRANSPORT_OPTIONS = [
    { value: UNSET, label: "Padrão do sistema" },
    { value: "transport-udp", label: "UDP" },
    { value: "transport-tcp", label: "TCP" },
]

const DTMF_MODE_OPTIONS = [
    { value: UNSET, label: "Padrão (rfc4733)" },
    { value: "rfc4733", label: "RFC 4733" },
    { value: "inband", label: "Inband" },
    { value: "info", label: "SIP INFO" },
    { value: "auto", label: "Auto" },
]

const REL_OPTIONS = [
    { value: UNSET, label: "Padrão (yes)" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
    { value: "required", label: "Required" },
]

const TIMERS_OPTIONS = [
    { value: UNSET, label: "Padrão (yes)" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
    { value: "always", label: "Always" },
]

const IAX_QUALIFY_OPTIONS = [
    { value: UNSET, label: "Padrão (yes)" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
]

const IAX_TRANSFER_OPTIONS = [
    { value: UNSET, label: "Padrão (mediaonly)" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "mediaonly", label: "Mediaonly" },
]

function AdvancedSelect({
    label,
    name,
    control,
    items,
}: {
    label: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: any
    items: { value: string; label: string }[]
}) {
    return (
        <Field>
            <FieldLabel>{label}</FieldLabel>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <Select
                        items={items}
                        value={field.value ?? UNSET}
                        onValueChange={(v) =>
                            field.onChange(v === UNSET ? undefined : v)
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {items.map((i) => (
                                <SelectItem key={i.value} value={i.value}>
                                    {i.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            />
        </Field>
    )
}

function AdvancedSwitch({
    label,
    name,
    control,
}: {
    label: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: any
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <Field orientation="horizontal" className="gap-3 py-1">
                    <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                    />
                    <FieldLabel>{label}</FieldLabel>
                </Field>
            )}
        />
    )
}

const emptyCustomHeader = { name: "", value: "" }

type Props =
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          trunk: null
          companies: Company[]
          onCreate: (form: TrunkCreateForm) => Promise<Trunk | null>
          onUpdate?: never
      }
    | {
          open: boolean
          onOpenChange: (open: boolean) => void
          trunk: Trunk
          companies: Company[]
          onCreate?: never
          onUpdate: (form: TrunkUpdateForm) => Promise<boolean>
      }

export function TrunkFormDialog({
    open,
    onOpenChange,
    trunk,
    companies,
    onCreate,
    onUpdate,
}: Props) {
    const isEdit = !!trunk

    const createForm = useForm<TrunkCreateForm>({
        resolver: zodResolver(createTrunkSchema) as any,
        defaultValues: {
            type: "pjsip",
            registrationMode: "outbound",
            name: "",
            companyId: "",
            codecs: "ulaw,alaw",
            host: "",
            port: undefined,
            username: "",
            password: "",
            transport: undefined,
            dtmfMode: undefined,
            directMedia: undefined,
            qualifyFrequency: undefined,
            qualifyTimeout: undefined,
            outboundProxy: "",
            iceSupport: undefined,
            rel: undefined,
            timers: undefined,
            timersMinSe: undefined,
            timersSessExpires: undefined,
            sendDiversion: undefined,
            customHeaders: [],
            qualify: undefined,
            trunkMode: undefined,
            encryption: undefined,
            transfer: undefined,
            jitterbuffer: undefined,
            context: "",
        } as any,
    })

    const createRegistrationMode = useWatch({
        control: createForm.control,
        name: "registrationMode",
    }) as RegistrationMode
    const registrationMode = isEdit
        ? trunk.registrationMode
        : createRegistrationMode
    const isInboundMode = registrationMode === "inbound"
    const isCustomMode = registrationMode === "custom"

    const createType = useWatch({
        control: createForm.control,
        name: "type",
    }) as TrunkType
    const trunkType = isEdit ? trunk.type : createType
    const isIaxType = trunkType === "iax"

    const updateForm = useForm<TrunkUpdateForm>({
        resolver: zodResolver(updateTrunkSchema) as any,
    })

    const createHeaderFields = useFieldArray({
        control: createForm.control,
        name: "customHeaders",
    })
    const updateHeaderFields = useFieldArray({
        control: updateForm.control,
        name: "customHeaders",
    })
    const headerFields = isEdit ? updateHeaderFields : createHeaderFields

    useEffect(() => {
        if (!open) return
        if (isEdit) {
            updateForm.reset({
                host: trunk.host ?? "",
                port: trunk.port ?? undefined,
                username: trunk.username ?? "",
                password: trunk.password ?? "",
                codecs: trunk.codecs,
                maxInChannels: trunk.maxInChannels ?? undefined,
                maxOutChannels: trunk.maxOutChannels ?? undefined,
                transport: trunk.transport ?? undefined,
                dtmfMode: trunk.dtmfMode ?? undefined,
                directMedia: trunk.directMedia ?? undefined,
                qualifyFrequency: trunk.qualifyFrequency ?? undefined,
                qualifyTimeout: trunk.qualifyTimeout ?? undefined,
                outboundProxy: trunk.outboundProxy ?? "",
                iceSupport: trunk.iceSupport ?? undefined,
                rel: trunk.rel ?? undefined,
                timers: trunk.timers ?? undefined,
                timersMinSe: trunk.timersMinSe ?? undefined,
                timersSessExpires: trunk.timersSessExpires ?? undefined,
                sendDiversion: trunk.sendDiversion ?? undefined,
                customHeaders: trunk.customHeaders ?? [],
                qualify: trunk.qualify ?? undefined,
                trunkMode: trunk.trunkMode ?? undefined,
                encryption: trunk.encryption ?? undefined,
                transfer: trunk.transfer ?? undefined,
                jitterbuffer: trunk.jitterbuffer ?? undefined,
                context:
                    trunk.registrationMode === "custom"
                        ? trunk.context
                        : undefined,
            } as any)
        } else {
            createForm.reset({
                type: "pjsip",
                registrationMode: "outbound",
                name: "",
                companyId: "",
                codecs: "ulaw,alaw",
                host: "",
                port: undefined,
                username: "",
                password: "",
                transport: undefined,
                dtmfMode: undefined,
                directMedia: undefined,
                qualifyFrequency: undefined,
                qualifyTimeout: undefined,
                outboundProxy: "",
                iceSupport: undefined,
                rel: undefined,
                timers: undefined,
                timersMinSe: undefined,
                timersSessExpires: undefined,
                sendDiversion: undefined,
                customHeaders: [],
                qualify: undefined,
                trunkMode: undefined,
                encryption: undefined,
                transfer: undefined,
                jitterbuffer: undefined,
                context: "",
            } as any)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isEdit, trunk])

    const handleCreate = createForm.handleSubmit(async (form) => {
        const result = await onCreate!(form)
        if (result) onOpenChange(false)
    })

    const handleUpdate = updateForm.handleSubmit(async (form) => {
        const ok = await onUpdate!(form)
        if (ok) onOpenChange(false)
    })

    // registrationMode "custom" não compartilha campos com outbound/inbound no discriminated
    // union — any evita a união impossível de resolver estaticamente (mesmo padrão já usado
    // no resolver/defaultValues dos dois useForm acima)
    const r = (isEdit ? updateForm.register : createForm.register) as any
    const control = (isEdit ? updateForm.control : createForm.control) as any
    const errors = (isEdit
        ? updateForm.formState.errors
        : createForm.formState.errors) as any
    const isSubmitting = isEdit
        ? updateForm.formState.isSubmitting
        : createForm.formState.isSubmitting

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-full flex-col sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar tronco" : "Novo tronco"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `${trunk.name} - ${
                                  trunk.registrationMode === "outbound"
                                      ? "Outbound"
                                      : trunk.registrationMode === "custom"
                                        ? "Custom"
                                        : `Inbound (identificado por ${trunk.identifyBy === "username" ? "usuário" : "IP"})`
                              }`
                            : "Preencha os dados para criar o tronco"}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="trunk-form"
                    onSubmit={isEdit ? handleUpdate : handleCreate}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">
                        <FieldGroup>
                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Tipo</FieldLabel>
                                    <Controller
                                        control={createForm.control}
                                        name="type"
                                        render={({ field }) => (
                                            <Select
                                                items={TRUNK_TYPES}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {TRUNK_TYPES.map((t) => (
                                                        <SelectItem
                                                            key={t.value}
                                                            value={t.value}
                                                        >
                                                            {t.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </Field>
                            )}

                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Modo de registro</FieldLabel>
                                    <Controller
                                        control={createForm.control}
                                        name="registrationMode"
                                        render={({ field }) => (
                                            <Select
                                                items={REGISTRATION_MODES}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {REGISTRATION_MODES.map(
                                                        (m) => (
                                                            <SelectItem
                                                                key={m.value}
                                                                value={m.value}
                                                            >
                                                                {m.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </Field>
                            )}

                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: provedor-voip"
                                        {...createForm.register("name")}
                                    />
                                    {createForm.formState.errors.name && (
                                        <FieldError>
                                            {
                                                createForm.formState.errors.name
                                                    .message as string
                                            }
                                        </FieldError>
                                    )}
                                </Field>
                            )}

                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Empresa</FieldLabel>
                                    <Controller
                                        control={createForm.control}
                                        name="companyId"
                                        render={({ field }) => {
                                            const sel =
                                                companies.find(
                                                    (c) => c.id === field.value
                                                ) ?? null
                                            return (
                                                <Combobox<Company>
                                                    items={companies}
                                                    value={sel}
                                                    itemToStringLabel={(c) =>
                                                        c.name
                                                    }
                                                    isItemEqualToValue={(
                                                        a,
                                                        b
                                                    ) => a.id === b.id}
                                                    onValueChange={(company) =>
                                                        field.onChange(
                                                            company?.id ?? ""
                                                        )
                                                    }
                                                >
                                                    <ComboboxInput placeholder="Buscar empresa..." />
                                                    <ComboboxContent>
                                                        <ComboboxEmpty>
                                                            Nenhuma empresa
                                                        </ComboboxEmpty>
                                                        <ComboboxList>
                                                            {(
                                                                company: Company
                                                            ) => (
                                                                <ComboboxItem
                                                                    key={
                                                                        company.id
                                                                    }
                                                                    value={
                                                                        company
                                                                    }
                                                                >
                                                                    {
                                                                        company.name
                                                                    }
                                                                </ComboboxItem>
                                                            )}
                                                        </ComboboxList>
                                                    </ComboboxContent>
                                                </Combobox>
                                            )
                                        }}
                                    />
                                    {createForm.formState.errors.companyId && (
                                        <FieldError>
                                            {
                                                createForm.formState.errors
                                                    .companyId.message as string
                                            }
                                        </FieldError>
                                    )}
                                </Field>
                            )}

                            {isCustomMode && (
                                <Field>
                                    <FieldLabel>Contexto</FieldLabel>
                                    <Input
                                        placeholder="meu-contexto-custom"
                                        {...r("context")}
                                    />
                                    {(errors as any).context && (
                                        <FieldError>
                                            {
                                                (errors as any).context
                                                    .message as string
                                            }
                                        </FieldError>
                                    )}
                                    <FieldDescription>
                                        Ao usar esse tronco numa Outbound Route,
                                        em vez de discar via PJSIP a chamada faz{" "}
                                        <code>Goto(&lt;contexto&gt;,...)</code>{" "}
                                        pra esse contexto — você escreve o
                                        dialplan (inclusive o Dial, se precisar)
                                        diretamente no Asterisk. Não recebe
                                        chamadas (sem Inbound Route).
                                    </FieldDescription>
                                </Field>
                            )}

                            {!isCustomMode && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Field className="col-span-2">
                                            <FieldLabel>
                                                Host
                                                {isInboundMode
                                                    ? " (opcional)"
                                                    : ""}
                                            </FieldLabel>
                                            <Input
                                                placeholder="sip.provedor.com.br"
                                                {...r("host")}
                                            />
                                            {errors.host && (
                                                <FieldError>
                                                    {
                                                        errors.host
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                            {isInboundMode && (
                                                <FieldDescription>
                                                    Sem usuário, a identificação
                                                    da chamada é feita pelo host
                                                    (IP). Informando um usuário,
                                                    a identificação passa a ser
                                                    por usuário/senha.
                                                </FieldDescription>
                                            )}
                                            {!isInboundMode && isIaxType && (
                                                <FieldDescription>
                                                    IAX2 outbound não envia
                                                    REGISTER pro provedor
                                                    (limitação do Asterisk, sem
                                                    tabela realtime de
                                                    registro pra IAX2). Esse
                                                    tronco funciona como peer
                                                    estático autenticado por
                                                    IP + secret, não como
                                                    registro dinâmico. Use
                                                    apenas com provedores de
                                                    IP fixo.
                                                </FieldDescription>
                                            )}
                                        </Field>
                                        <Field>
                                            <FieldLabel>Porta</FieldLabel>
                                            <NumberInput
                                                placeholder="5060"
                                                {...r("port")}
                                            />
                                            {errors.port && (
                                                <FieldError>
                                                    {
                                                        errors.port
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field>
                                            <FieldLabel>
                                                Usuário
                                                {isInboundMode
                                                    ? " (opcional)"
                                                    : ""}
                                            </FieldLabel>
                                            <Input {...r("username")} />
                                            {errors.username && (
                                                <FieldError>
                                                    {
                                                        errors.username
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                            {isEdit &&
                                                isInboundMode &&
                                                trunk.identifyBy === "ip" && (
                                                    <FieldDescription>
                                                        Tronco identifica por
                                                        IP. Informando um
                                                        usuário, passa a
                                                        identificar por
                                                        usuário/senha.
                                                    </FieldDescription>
                                                )}
                                        </Field>
                                        <Field>
                                            <FieldLabel>
                                                Senha
                                                {isInboundMode
                                                    ? " (opcional)"
                                                    : ""}
                                            </FieldLabel>
                                            <Input {...r("password")} />
                                            {errors.password && (
                                                <FieldError>
                                                    {
                                                        errors.password
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>
                                    </div>

                                    <Field>
                                        <FieldLabel>Codecs</FieldLabel>
                                        <Controller
                                            control={control as any}
                                            name="codecs"
                                            render={({ field }) => (
                                                <CodecCheckboxes
                                                    value={field.value ?? ""}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                        {errors.codecs && (
                                            <FieldError>
                                                {
                                                    errors.codecs
                                                        .message as string
                                                }
                                            </FieldError>
                                        )}
                                    </Field>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field>
                                            <FieldLabel>
                                                Canais de entrada (máx)
                                            </FieldLabel>
                                            <NumberInput
                                                placeholder="Ilimitado"
                                                {...r("maxInChannels")}
                                            />
                                            {errors.maxInChannels && (
                                                <FieldError>
                                                    {
                                                        errors.maxInChannels
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>
                                        <Field>
                                            <FieldLabel>
                                                Canais de saída (máx)
                                            </FieldLabel>
                                            <NumberInput
                                                placeholder="Ilimitado"
                                                {...r("maxOutChannels")}
                                            />
                                            {errors.maxOutChannels && (
                                                <FieldError>
                                                    {
                                                        errors.maxOutChannels
                                                            .message as string
                                                    }
                                                </FieldError>
                                            )}
                                        </Field>
                                    </div>

                                    <Accordion multiple>
                                        {!isIaxType && (
                                        <AccordionItem value="advanced">
                                            <AccordionTrigger>
                                                Avançado (PJSIP)
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <AdvancedSelect
                                                            label="Transport"
                                                            name="transport"
                                                            control={control}
                                                            items={
                                                                TRANSPORT_OPTIONS
                                                            }
                                                        />
                                                        <AdvancedSelect
                                                            label="DTMF Mode"
                                                            name="dtmfMode"
                                                            control={control}
                                                            items={
                                                                DTMF_MODE_OPTIONS
                                                            }
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <FieldLabel>
                                                                Qualify
                                                                Frequency (s)
                                                            </FieldLabel>
                                                            <NumberInput
                                                                placeholder="60"
                                                                {...r(
                                                                    "qualifyFrequency"
                                                                )}
                                                            />
                                                            {errors.qualifyFrequency && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .qualifyFrequency
                                                                            .message as string
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                        <Field>
                                                            <FieldLabel>
                                                                Qualify Timeout
                                                                (s)
                                                            </FieldLabel>
                                                            <NumberInput
                                                                placeholder="3"
                                                                {...r(
                                                                    "qualifyTimeout"
                                                                )}
                                                            />
                                                            {errors.qualifyTimeout && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .qualifyTimeout
                                                                            .message as string
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <AdvancedSelect
                                                            label="100rel"
                                                            name="rel"
                                                            control={control}
                                                            items={REL_OPTIONS}
                                                        />
                                                        <AdvancedSelect
                                                            label="Session Timers"
                                                            name="timers"
                                                            control={control}
                                                            items={
                                                                TIMERS_OPTIONS
                                                            }
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <FieldLabel>
                                                                Timers Min-SE
                                                            </FieldLabel>
                                                            <NumberInput
                                                                placeholder="90"
                                                                {...r(
                                                                    "timersMinSe"
                                                                )}
                                                            />
                                                            {errors.timersMinSe && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .timersMinSe
                                                                            .message as string
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                        <Field>
                                                            <FieldLabel>
                                                                Timers
                                                                Sess-Expires
                                                            </FieldLabel>
                                                            <NumberInput
                                                                placeholder="1800"
                                                                {...r(
                                                                    "timersSessExpires"
                                                                )}
                                                            />
                                                            {errors.timersSessExpires && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .timersSessExpires
                                                                            .message as string
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </Field>
                                                    </div>
                                                    <Field>
                                                        <FieldLabel>
                                                            Outbound Proxy
                                                        </FieldLabel>
                                                        <Input
                                                            placeholder="sip:proxy.provedor.com.br"
                                                            {...r(
                                                                "outboundProxy"
                                                            )}
                                                        />
                                                        {errors.outboundProxy && (
                                                            <FieldError>
                                                                {
                                                                    errors
                                                                        .outboundProxy
                                                                        .message as string
                                                                }
                                                            </FieldError>
                                                        )}
                                                    </Field>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <AdvancedSwitch
                                                            label="Direct Media"
                                                            name="directMedia"
                                                            control={control}
                                                        />
                                                        <AdvancedSwitch
                                                            label="ICE Support"
                                                            name="iceSupport"
                                                            control={control}
                                                        />
                                                        <AdvancedSwitch
                                                            label="Send Diversion"
                                                            name="sendDiversion"
                                                            control={control}
                                                        />
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        )}

                                        {isIaxType && (
                                        <AccordionItem value="advanced-iax">
                                            <AccordionTrigger>
                                                Avançado (IAX2)
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <AdvancedSelect
                                                            label="Qualify"
                                                            name="qualify"
                                                            control={control}
                                                            items={
                                                                IAX_QUALIFY_OPTIONS
                                                            }
                                                        />
                                                        <AdvancedSelect
                                                            label="Transfer"
                                                            name="transfer"
                                                            control={control}
                                                            items={
                                                                IAX_TRANSFER_OPTIONS
                                                            }
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <AdvancedSwitch
                                                            label="Trunk mode"
                                                            name="trunkMode"
                                                            control={control}
                                                        />
                                                        <AdvancedSwitch
                                                            label="Encryption"
                                                            name="encryption"
                                                            control={control}
                                                        />
                                                        <AdvancedSwitch
                                                            label="Jitterbuffer"
                                                            name="jitterbuffer"
                                                            control={control}
                                                        />
                                                    </div>
                                                    <FieldDescription>
                                                        Trunk mode otimiza o
                                                        transporte pra alto
                                                        volume de chamadas
                                                        ponto a ponto
                                                        (meta-frame). Encryption
                                                        usa AES128 nativo do
                                                        IAX2 com o secret
                                                        configurado acima, só
                                                        funciona se o outro
                                                        lado também suportar.
                                                    </FieldDescription>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        )}

                                        {!isIaxType && (
                                        <AccordionItem value="headers">
                                            <AccordionTrigger>
                                                Headers SIP customizados
                                                (outbound)
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <FieldDescription>
                                                            Injetados via{" "}
                                                            <code>
                                                                Set(PJSIP_HEADER(add,...))
                                                            </code>{" "}
                                                            antes de cada
                                                            tentativa de Dial
                                                            nas rotas de saída
                                                            que usam essa trunk.
                                                            Valor literal, sem
                                                            interpolação de
                                                            variável.
                                                        </FieldDescription>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                headerFields.append(
                                                                    emptyCustomHeader,
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
                                                    {headerFields.fields
                                                        .length === 0 ? (
                                                        <FieldDescription>
                                                            Nenhum header
                                                            configurado.
                                                        </FieldDescription>
                                                    ) : (
                                                        <div className="space-y-2 rounded-md border p-2">
                                                            <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-2">
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    Nome
                                                                </span>
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    Valor
                                                                </span>
                                                                <span />
                                                            </div>
                                                            {headerFields.fields.map(
                                                                (
                                                                    field,
                                                                    index
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            field.id
                                                                        }
                                                                        className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-2"
                                                                    >
                                                                        <div>
                                                                            <Input
                                                                                placeholder="X-Custom-Header"
                                                                                {...r(
                                                                                    `customHeaders.${index}.name`
                                                                                )}
                                                                            />
                                                                            {(
                                                                                errors as any
                                                                            )
                                                                                .customHeaders?.[
                                                                                index
                                                                            ]
                                                                                ?.name && (
                                                                                <FieldError>
                                                                                    {
                                                                                        (
                                                                                            errors as any
                                                                                        )
                                                                                            .customHeaders[
                                                                                            index
                                                                                        ]
                                                                                            .name
                                                                                            .message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Input
                                                                                placeholder="valor"
                                                                                {...r(
                                                                                    `customHeaders.${index}.value`
                                                                                )}
                                                                            />
                                                                            {(
                                                                                errors as any
                                                                            )
                                                                                .customHeaders?.[
                                                                                index
                                                                            ]
                                                                                ?.value && (
                                                                                <FieldError>
                                                                                    {
                                                                                        (
                                                                                            errors as any
                                                                                        )
                                                                                            .customHeaders[
                                                                                            index
                                                                                        ]
                                                                                            .value
                                                                                            .message
                                                                                    }
                                                                                </FieldError>
                                                                            )}
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                headerFields.remove(
                                                                                    index
                                                                                )
                                                                            }
                                                                        >
                                                                            <XIcon />
                                                                            <span className="sr-only">
                                                                                Remover
                                                                                header
                                                                            </span>
                                                                        </Button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        )}
                                    </Accordion>
                                </>
                            )}
                        </FieldGroup>
                    </div>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="trunk-form"
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
    )
}
