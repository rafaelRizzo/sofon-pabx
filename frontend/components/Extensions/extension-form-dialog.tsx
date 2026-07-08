"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

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
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
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
    createExtensionSchema,
    updateExtensionSchema,
    useExtensions,
    type Extension,
    type ExtensionCreateForm,
    type ExtensionUpdateForm,
} from "@/hooks/use-extensions"
import { toast } from "sonner"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StrInput({
    label,
    name,
    register,
    placeholder,
}: {
    label: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: any
    placeholder?: string
}) {
    return (
        <Field>
            <FieldLabel>{label}</FieldLabel>
            <Input placeholder={placeholder} {...register(name)} />
        </Field>
    )
}

function NumInput({
    label,
    name,
    register,
}: {
    label: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: any
}) {
    return (
        <Field>
            <FieldLabel>{label}</FieldLabel>
            <Input type="number" {...register(name)} />
        </Field>
    )
}

function CodecField({
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
                <Field>
                    <FieldLabel>{label}</FieldLabel>
                    <CodecCheckboxes
                        value={field.value ?? ""}
                        onChange={field.onChange}
                    />
                </Field>
            )}
        />
    )
}

function BoolSwitch({
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

const G2 = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-2 gap-3">{children}</div>
)

// ─── Seções SIP ──────────────────────────────────────────────────────────────

function SipSections({ r, c }: { r: any; c: any }) {
    return (
        <Accordion multiple>
            <AccordionItem value="connection">
                <AccordionTrigger>Conexão</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput label="Host" name="host" register={r} />
                        <Field>
                            <FieldLabel>Tipo de peer</FieldLabel>
                            <Controller
                                control={c}
                                name="peerType"
                                render={({ field }) => (
                                    <Select
                                        items={[
                                            {
                                                value: "friend",
                                                label: "Friend",
                                            },
                                            { value: "peer", label: "Peer" },
                                            { value: "user", label: "User" },
                                        ]}
                                        value={field.value ?? ""}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["friend", "peer", "user"].map(
                                                (v) => (
                                                    <SelectItem
                                                        key={v}
                                                        value={v}
                                                    >
                                                        {v}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>
                        <StrInput label="NAT" name="nat" register={r} />
                        <StrInput
                            label="Transport"
                            name="transport"
                            register={r}
                        />
                        <StrInput label="Qualify" name="qualify" register={r} />
                        <StrInput
                            label="Insecure"
                            name="insecure"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="codecs">
                <AccordionTrigger>Codecs</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-3">
                        <CodecField label="Allow" name="allow" control={c} />
                        <G2>
                            <StrInput
                                label="Disallow"
                                name="disallow"
                                register={r}
                            />
                            <StrInput
                                label="DTMF Mode"
                                name="dtmfMode"
                                register={r}
                            />
                            <StrInput
                                label="Direct Media"
                                name="directMedia"
                                register={r}
                            />
                            <StrInput
                                label="Language"
                                name="language"
                                register={r}
                            />
                        </G2>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="callerid">
                <AccordionTrigger>Caller ID</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="Caller ID"
                            name="callerId"
                            register={r}
                        />
                        <StrInput
                            label="Default User"
                            name="defaultUser"
                            register={r}
                        />
                        <StrInput
                            label="From User"
                            name="fromUser"
                            register={r}
                        />
                        <StrInput
                            label="From Domain"
                            name="fromDomain"
                            register={r}
                        />
                        <StrInput
                            label="Full Name"
                            name="fullName"
                            register={r}
                        />
                        <StrInput
                            label="Trunk Name"
                            name="trunkName"
                            register={r}
                        />
                        <StrInput
                            label="CID Number"
                            name="cidNumber"
                            register={r}
                        />
                        <StrInput
                            label="Calling Pres"
                            name="callingPres"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security">
                <AccordionTrigger>Segurança</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput label="Permit" name="permit" register={r} />
                        <StrInput label="Deny" name="deny" register={r} />
                        <StrInput label="Auth" name="auth" register={r} />
                        <StrInput
                            label="Trust RPID"
                            name="trustRpid"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="timers">
                <AccordionTrigger>Timers / RTP</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <NumInput
                            label="Timer T1"
                            name="timerT1"
                            register={r}
                        />
                        <NumInput label="Timer B" name="timerB" register={r} />
                        <NumInput
                            label="Qualify Freq"
                            name="qualifyFreq"
                            register={r}
                        />
                        <StrInput
                            label="Session Timers"
                            name="sessionTimers"
                            register={r}
                        />
                        <NumInput
                            label="Session Expires"
                            name="sessionExpires"
                            register={r}
                        />
                        <NumInput
                            label="Session MinSE"
                            name="sessionMinse"
                            register={r}
                        />
                        <StrInput
                            label="Session Refresher"
                            name="sessionRefresher"
                            register={r}
                        />
                        <NumInput
                            label="RTP Timeout"
                            name="rtpTimeout"
                            register={r}
                        />
                        <NumInput
                            label="RTP Hold Timeout"
                            name="rtpHoldTimeout"
                            register={r}
                        />
                        <NumInput
                            label="RTP Keepalive"
                            name="rtpKeepalive"
                            register={r}
                        />
                        <StrInput
                            label="T38PT Usertpsource"
                            name="t38ptUsertpsource"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
                <AccordionTrigger>Grupos</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="Call Group"
                            name="callGroup"
                            register={r}
                        />
                        <StrInput
                            label="Pickup Group"
                            name="pickupGroup"
                            register={r}
                        />
                        <StrInput
                            label="Account Code"
                            name="accountCode"
                            register={r}
                        />
                        <StrInput
                            label="Allow Subscribe"
                            name="allowSubscribe"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="moh">
                <AccordionTrigger>Estacionamento</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="Parking Lot"
                            name="parkingLot"
                            register={r}
                        />
                        <StrInput
                            label="Reg Exten"
                            name="regExten"
                            register={r}
                        />
                        <StrInput
                            label="Default IP"
                            name="defaultIp"
                            register={r}
                        />
                        <StrInput
                            label="Outbound Proxy"
                            name="outboundProxy"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="advanced">
                <AccordionTrigger>Avançado</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="Video Support"
                            name="videoSupport"
                            register={r}
                        />
                        <NumInput
                            label="Max Call Bitrate"
                            name="maxCallBitrate"
                            register={r}
                        />
                        <StrInput
                            label="Progress In Band"
                            name="progressInBand"
                            register={r}
                        />
                        <StrInput
                            label="Send RPID"
                            name="sendRpid"
                            register={r}
                        />
                        <StrInput
                            label="Callback Extension"
                            name="callbackExtension"
                            register={r}
                        />
                        <StrInput label="Set Var" name="setVar" register={r} />
                        <StrInput
                            label="AMA Flags"
                            name="amaFlags"
                            register={r}
                        />
                        <StrInput
                            label="Call Counter"
                            name="callCounter"
                            register={r}
                        />
                        <NumInput
                            label="Busy Level"
                            name="busyLevel"
                            register={r}
                        />
                        <StrInput
                            label="Allow Overlap"
                            name="allowOverlap"
                            register={r}
                        />
                        <StrInput
                            label="RFC2833 Compensate"
                            name="rfc2833Compensate"
                            register={r}
                        />
                        <StrInput
                            label="Promiscuous Redir"
                            name="promiscRedir"
                            register={r}
                        />
                        <StrInput
                            label="Use Client Code"
                            name="useClientCode"
                            register={r}
                        />
                        <StrInput
                            label="Constants Src"
                            name="constantsSrc"
                            register={r}
                        />
                        <StrInput
                            label="Contact Permit"
                            name="contactPermit"
                            register={r}
                        />
                        <StrInput
                            label="Contact Deny"
                            name="contactDeny"
                            register={r}
                        />
                        <StrInput
                            label="Use Req Phone"
                            name="useReqPhone"
                            register={r}
                        />
                        <StrInput
                            label="Text Support"
                            name="textSupport"
                            register={r}
                        />
                        <StrInput
                            label="Fax Detect"
                            name="faxDetect"
                            register={r}
                        />
                        <StrInput
                            label="Buggy MWI"
                            name="buggyMwi"
                            register={r}
                        />
                        <StrInput
                            label="Auto Framing"
                            name="autoFraming"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

// ─── Seções PJSIP ────────────────────────────────────────────────────────────

function PjsipSections({ r, c }: { r: any; c: any }) {
    return (
        <Accordion multiple>
            <AccordionItem value="codecs">
                <AccordionTrigger>Codecs</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-3">
                        <CodecField label="Allow" name="allow" control={c} />
                        <G2>
                            <StrInput
                                label="Disallow"
                                name="disallow"
                                register={r}
                            />
                            <StrInput
                                label="DTMF Mode"
                                name="dtmfMode"
                                register={r}
                            />
                            <StrInput
                                label="Language"
                                name="language"
                                register={r}
                            />
                        </G2>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="media">
                <AccordionTrigger>Mídia / RTP</AccordionTrigger>
                <AccordionContent>
                    <div className="flex flex-col gap-2 pt-2">
                        <BoolSwitch
                            label="Direct Media"
                            name="directMedia"
                            control={c}
                        />
                        <BoolSwitch
                            label="RTP Symmetric"
                            name="rtpSymmetric"
                            control={c}
                        />
                        <BoolSwitch
                            label="Force rport"
                            name="forceRport"
                            control={c}
                        />
                        <BoolSwitch
                            label="ICE Support"
                            name="iceSupport"
                            control={c}
                        />
                        <BoolSwitch
                            label="Rewrite Contact"
                            name="rewriteContact"
                            control={c}
                        />
                        <BoolSwitch
                            label="Send Diversion"
                            name="sendDiversion"
                            control={c}
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="callerid">
                <AccordionTrigger>Caller ID</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="From User"
                            name="fromUser"
                            register={r}
                        />
                        <StrInput
                            label="From Domain"
                            name="fromDomain"
                            register={r}
                        />
                        <StrInput
                            label="Transport"
                            name="transport"
                            register={r}
                        />
                        <StrInput
                            label="Outbound Proxy"
                            name="outboundProxy"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features">
                <AccordionTrigger>Funcionalidades</AccordionTrigger>
                <AccordionContent>
                    <div className="flex flex-col gap-2 pt-2">
                        <BoolSwitch
                            label="Allow Transfer"
                            name="allowTransfer"
                            control={c}
                        />
                        <BoolSwitch
                            label="Allow Subscribe"
                            name="allowSubscribe"
                            control={c}
                        />
                        <BoolSwitch
                            label="One Touch Recording"
                            name="oneTouchRecording"
                            control={c}
                        />
                    </div>
                    <G2>
                        <StrInput label="Rel" name="rel" register={r} />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="timers">
                <AccordionTrigger>Timers</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput label="Timers" name="timers" register={r} />
                        <NumInput
                            label="Timers Min SE"
                            name="timersMinSe"
                            register={r}
                        />
                        <NumInput
                            label="Timers Sess Expires"
                            name="timersSessExpires"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="aor">
                <AccordionTrigger>AOR</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <NumInput
                            label="Max Contacts"
                            name="aorMaxContacts"
                            register={r}
                        />
                        <NumInput
                            label="Qualify Frequency"
                            name="aorQualifyFrequency"
                            register={r}
                        />
                        <NumInput
                            label="Qualify Timeout"
                            name="aorQualifyTimeout"
                            register={r}
                        />
                        <NumInput
                            label="Min Expiration"
                            name="aorMinimumExpiration"
                            register={r}
                        />
                        <NumInput
                            label="Max Expiration"
                            name="aorMaximumExpiration"
                            register={r}
                        />
                        <NumInput
                            label="Default Expiration"
                            name="aorDefaultExpiration"
                            register={r}
                        />
                        <StrInput
                            label="Outbound Proxy"
                            name="aorOutboundProxy"
                            register={r}
                        />
                    </G2>
                    <div className="flex flex-col gap-2 pt-3">
                        <BoolSwitch
                            label="Remove Existing"
                            name="aorRemoveExisting"
                            control={c}
                        />
                        <BoolSwitch
                            label="Authenticate Qualify"
                            name="aorAuthenticateQualify"
                            control={c}
                        />
                        <BoolSwitch
                            label="Support Path"
                            name="aorSupportPath"
                            control={c}
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
                <AccordionTrigger>Grupos</AccordionTrigger>
                <AccordionContent>
                    <G2>
                        <StrInput
                            label="Named Call Group"
                            name="namedCallGroup"
                            register={r}
                        />
                        <StrInput
                            label="Named Pickup Group"
                            name="namedPickupGroup"
                            register={r}
                        />
                    </G2>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

// ─── Dialog Principal ───────────────────────────────────────────────────────

const TYPES = [
    { value: "pjsip", label: "PJSIP" },
    { value: "sip", label: "SIP (legado)" },
]

type Props =
    | {
        open: boolean
        onOpenChange: (open: boolean) => void
        extension: null
        companies: Company[]
        onCreate: (form: ExtensionCreateForm) => Promise<any>
        onUpdate?: never
    }
    | {
        open: boolean
        onOpenChange: (open: boolean) => void
        extension: Extension | string
        companies: Company[]
        onCreate?: never
        onUpdate: (form: ExtensionUpdateForm) => Promise<boolean>
    }

export function ExtensionFormDialog({
    open,
    onOpenChange,
    extension,
    companies,
    onCreate,
    onUpdate,
}: Props) {
    const isEdit = !!extension

    const [loadingExtension, setLoadingExtension] = useState(false)
    const [currentExtension, setCurrentExtension] = useState<Extension | null>(
        null
    )

    const { getExtensionById } = useExtensions()

    // Fetch do ramal ao editar
    // Sempre busca da API ao editar (versão forte)
    useEffect(() => {
        const loadExtension = async () => {
            if (!open || !isEdit) return

            setLoadingExtension(true)

            const id = typeof extension === "string" ? extension : extension?.id

            if (!id) {
                setLoadingExtension(false)
                return
            }

            const freshExtension = await getExtensionById(id)

            if (freshExtension) {
                setCurrentExtension(freshExtension)
            } else {
                toast.error(
                    "Não foi possível carregar os dados atualizados do ramal"
                )
                // fallback caso a API falhe
                if (typeof extension !== "string" && extension) {
                    setCurrentExtension(extension)
                }
            }

            setLoadingExtension(false)
        }

        loadExtension()
    }, [open, extension, isEdit, getExtensionById])

    const extensionData = isEdit ? currentExtension : null

    // Create Form
    const createForm = useForm<ExtensionCreateForm>({
        resolver: zodResolver(createExtensionSchema) as any,
        defaultValues: {
            type: "pjsip",
            alias: "",
            name: "",
            companyId: "",
            context: "ramais",
            allowOutbound: true,
        },
    })

    const currentType = useWatch({ control: createForm.control, name: "type" })
    const prevType = useRef<string>("pjsip")

    // Update Form
    const updateForm = useForm<ExtensionUpdateForm>({
        resolver: zodResolver(updateExtensionSchema) as any,
    })

    // Reset do form de edição
    useEffect(() => {
        if (!open || !isEdit || !extensionData) return

        const defaults = Object.fromEntries(
            Object.entries(extensionData)
                .filter(
                    ([k]) =>
                        ![
                            "id",
                            "username",
                            "type",
                            "companyId",
                            "createdAt",
                            "updatedAt",
                        ].includes(k)
                )
                .map(([k, v]) => [k, v === null ? undefined : v])
        ) as Partial<ExtensionUpdateForm>

        updateForm.reset(defaults)
    }, [open, isEdit, extensionData, updateForm])

    // Espelha sipCreateDefaults/pjsipCreateDefaults de backend/src/modules/extensions/schemas/extension.schema.ts
    const applyTypeDefaults = (type: "sip" | "pjsip") => {
        if (type === "pjsip") {
            createForm.setValue("transport", "transport-udp")
            createForm.setValue("disallow", "all")
            createForm.setValue("allow", "ulaw,alaw")
            createForm.setValue("directMedia", false)
            createForm.setValue("dtmfMode", "rfc4733")
            createForm.setValue("forceRport", true)
            createForm.setValue("iceSupport", false)
            createForm.setValue("rewriteContact", true)
            createForm.setValue("rtpSymmetric", true)
            createForm.setValue("sendDiversion", true)
            createForm.setValue("timers", "yes")
            createForm.setValue("timersMinSe", 90)
            createForm.setValue("timersSessExpires", 1800)
            createForm.setValue("language", "pt_BR")
            createForm.setValue("oneTouchRecording", false)
            createForm.setValue("allowTransfer", true)
            createForm.setValue("allowSubscribe", true)
            createForm.setValue("rel", "yes")
            createForm.setValue("aorMaxContacts", 1)
            createForm.setValue("aorQualifyFrequency", 60)
            createForm.setValue("aorQualifyTimeout", 3)
            createForm.setValue("aorMinimumExpiration", 60)
            createForm.setValue("aorMaximumExpiration", 7200)
            createForm.setValue("aorDefaultExpiration", 3600)
            createForm.setValue("aorRemoveExisting", true)
            createForm.setValue("aorAuthenticateQualify", false)
            createForm.setValue("aorSupportPath", false)
        } else {
            createForm.setValue("host", "dynamic")
            createForm.setValue("peerType", "friend")
            createForm.setValue("nat", "force_rport,comedia")
            createForm.setValue("dtmfMode", "rfc2833")
            createForm.setValue("directMedia", "no")
            createForm.setValue("qualify", "yes")
            createForm.setValue("disallow", "all")
            createForm.setValue("allow", "ulaw,alaw")
            createForm.setValue("insecure", "port,invite")
            createForm.setValue("transport", "udp")
            createForm.setValue("callCounter", "yes")
            createForm.setValue("allowOverlap", "no")
            createForm.setValue("allowSubscribe", "yes")
            createForm.setValue("videoSupport", "no")
            createForm.setValue("sessionTimers", "accept")
            createForm.setValue("sessionExpires", 1800)
            createForm.setValue("sessionMinse", 90)
            createForm.setValue("sessionRefresher", "uas")
            createForm.setValue("qualifyFreq", 60)
            createForm.setValue("rtpKeepalive", 0)
        }
    }

    useEffect(() => {
        if (!open || isEdit) return
        if (prevType.current === currentType) return
        prevType.current = currentType
        applyTypeDefaults(currentType as "sip" | "pjsip")
    }, [currentType, open, isEdit])

    useEffect(() => {
        if (!open || isEdit) return
        prevType.current = "pjsip"
        createForm.reset({
            type: "pjsip",
            alias: "",
            name: "",
            companyId: "",
            context: "ramais",
            allowOutbound: true,
        })
        applyTypeDefaults("pjsip")
    }, [open, isEdit, createForm])

    const handleCreate = createForm.handleSubmit(async (form) => {
        const result = await onCreate!(form)
        if (result !== null) onOpenChange(false)
    })

    const handleUpdate = updateForm.handleSubmit(async (form) => {
        const ok = await onUpdate!(form)
        if (ok) onOpenChange(false)
    })

    const r = isEdit ? updateForm.register : createForm.register
    const c = isEdit ? updateForm.control : createForm.control
    const errors = isEdit
        ? updateForm.formState.errors
        : createForm.formState.errors
    const isSubmitting = isEdit
        ? updateForm.formState.isSubmitting
        : createForm.formState.isSubmitting
    const extType = isEdit && extensionData ? extensionData.type : currentType

    if (isEdit && loadingExtension) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle
                            render={<Skeleton className="h-5 w-40" />}
                        />
                        <DialogDescription
                            render={<Skeleton className="h-4 w-64" />}
                        />
                    </DialogHeader>

                    <div className="flex h-[65vh] flex-col gap-4 overflow-hidden pr-3">
                        <G2>
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                        </G2>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-8 w-32" />
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-11 w-full" />
                        ))}
                    </div>

                    <DialogFooter>
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    const control = (isEdit ? updateForm.control : createForm.control) as any

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar ramal" : "Novo ramal"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit && extensionData
                            ? `${extensionData.alias} — ${extensionData.name} (${extensionData.type.toUpperCase()})`
                            : "Preencha os dados para criar o ramal"}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[65vh]">
                    <form
                        id="extension-form"
                        onSubmit={isEdit ? handleUpdate : handleCreate}
                    >
                        <FieldGroup className="pr-3">
                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Tipo</FieldLabel>
                                    <Controller
                                        control={createForm.control}
                                        name="type"
                                        render={({ field }) => (
                                            <Select
                                                items={TYPES}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {TYPES.map((t) => (
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

                            <G2>
                                <Field>
                                    <FieldLabel>Ramal</FieldLabel>
                                    <Input
                                        placeholder="Ex: 1001"
                                        {...r("alias")}
                                    />
                                    {errors.alias && (
                                        <FieldError>
                                            {errors.alias.message}
                                        </FieldError>
                                    )}
                                </Field>
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Nome do usuário"
                                        {...r("name")}
                                    />
                                    {errors.name && (
                                        <FieldError>
                                            {errors.name.message}
                                        </FieldError>
                                    )}
                                </Field>
                            </G2>

                            {isEdit && extensionData && (
                                <Field>
                                    <FieldLabel>Usuário SIP</FieldLabel>
                                    <div className="flex h-7 items-center rounded-md border border-input bg-input/20 px-2 font-mono text-sm select-all dark:bg-input/30">
                                        {extensionData.username}
                                    </div>
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
                                </Field>
                            )}

                            <Field>
                                <FieldLabel>Contexto</FieldLabel>
                                <Input {...r("context")} />
                            </Field>

                            <Controller
                                control={control}
                                name="allowOutbound"
                                render={({ field }) => (
                                    <Field
                                        orientation="horizontal"
                                        className="items-center gap-3 self-center pb-0.5"
                                    >
                                        <Switch
                                            id="allowOutbound"
                                            checked={!!field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        <FieldLabel htmlFor="allowOutbound">
                                            Permitir saída
                                        </FieldLabel>
                                    </Field>
                                )}
                            />

                            {extType === "sip" ? (
                                <SipSections r={r} c={c} />
                            ) : (
                                <PjsipSections r={r} c={c} />
                            )}
                        </FieldGroup>
                    </form>
                </ScrollArea>

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
                        form="extension-form"
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
