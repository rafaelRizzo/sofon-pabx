"use client"

import { useEffect, useState } from "react"
import {
    BracesIcon,
    CalendarDaysIcon,
    FilterIcon,
    GlobeIcon,
    ListTreeIcon,
    MegaphoneIcon,
    PhoneIcon,
    PhoneOffIcon,
    ClockIcon,
    UsersIcon,
    WorkflowIcon,
    NetworkIcon,
    type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

// Espelha routeDestinationSchema de backend/src/schemas/route-destination.schema.ts —
// compartilhado por Inbound Routes, Time Conditions, Queues, IVR e Request Templates.
export const ROUTE_DEST_TYPES = [
    "hangup",
    "extension",
    "queue",
    "timecondition",
    "holiday",
    "announcement",
    "ivr",
    "request",
    "ixc",
    "variable-set",
    "variable-condition",
    "flow",
] as const

export type RouteDestinationType = (typeof ROUTE_DEST_TYPES)[number]

export const ROUTE_DEST_LABELS: Record<RouteDestinationType, string> = {
    hangup: "Encerrar chamada",
    extension: "Ramal",
    queue: "Fila",
    timecondition: "Condição de horário",
    holiday: "Grupo de feriados",
    announcement: "Anúncio",
    ivr: "URA",
    request: "Request Template",
    ixc: "IXCsoft",
    "variable-set": "Setar variável",
    "variable-condition": "Validar variável",
    flow: "Flow",
}

// Passado como `items` pro Select — sem isso o trigger mostra o value cru (ex: "extension")
// em vez do label traduzido enquanto o SelectContent ainda não foi montado
const SELECT_ITEMS = ROUTE_DEST_TYPES.map((t) => ({
    value: t,
    label: ROUTE_DEST_LABELS[t],
}))

export const ROUTE_DEST_ICONS: Record<RouteDestinationType, LucideIcon> = {
    hangup: PhoneOffIcon,
    extension: PhoneIcon,
    queue: UsersIcon,
    timecondition: ClockIcon,
    holiday: CalendarDaysIcon,
    announcement: MegaphoneIcon,
    ivr: ListTreeIcon,
    request: GlobeIcon,
    ixc: NetworkIcon,
    "variable-set": BracesIcon,
    "variable-condition": FilterIcon,
    flow: WorkflowIcon,
}

const idSchema = z.string().min(1, "Campo obrigatório")

// label é preenchido só pelo backend (nome legível resolvido no GET, ver
// route-destination-label.ts) — nunca setado pelo form; ignorado (strip) se vier no submit.
const labelSchema = z.string().nullable().optional()

export const routeDestinationSchema = z
    .discriminatedUnion("type", [
        z.object({
            type: z.literal("extension"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("queue"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("timecondition"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("holiday"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("announcement"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({ type: z.literal("ivr"), id: idSchema, label: labelSchema }),
        z.object({
            type: z.literal("request"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("ixc"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("variable-set"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({
            type: z.literal("variable-condition"),
            id: idSchema,
            label: labelSchema,
        }),
        z.object({ type: z.literal("flow"), id: idSchema, label: labelSchema }),
        z.object({ type: z.literal("hangup") }),
    ])
    .nullable()

export type RouteDestination = z.infer<typeof routeDestinationSchema>

export type DestinationOption = {
    id: string
    label: string
    disabledReason?: string
}

export type FetchableDestinationType = Exclude<RouteDestinationType, "hangup">
type FetchableType = FetchableDestinationType

// Mensagem exibida no combobox quando a empresa ainda não tem nenhum registro desse
// recurso — evita parecer erro quando na verdade é só "ainda não cadastrou nada"
export const ROUTE_DEST_EMPTY_MESSAGES: Record<
    FetchableDestinationType,
    string
> = {
    extension: "Nenhum ramal cadastrado ainda",
    queue: "Nenhuma fila cadastrada ainda",
    timecondition: "Nenhuma condição de horário cadastrada ainda",
    holiday: "Nenhum grupo de feriados cadastrado ainda",
    announcement: "Nenhum anúncio cadastrado ainda",
    ivr: "Nenhuma URA cadastrada ainda",
    request: "Nenhum request template cadastrado ainda",
    ixc: "Nenhum nó IXCsoft cadastrado ainda",
    "variable-set": "Nenhuma variável cadastrada ainda",
    "variable-condition": "Nenhuma condição de variável cadastrada ainda",
    flow: "Nenhum flow cadastrado ainda",
}

// Cada tipo com FK busca sua própria lista (filtrada por empresa) — sem hook de CRUD
// dedicado pra cada recurso, só o necessário pro combobox de destino.
// announcement/ivr sem áudio ficam desabilitados (backend exige áudio pra usar como destino).
export async function fetchDestinationOptions(
    type: FetchableType,
    companyId: string
): Promise<DestinationOption[]> {
    switch (type) {
        case "extension": {
            const { data } = await api.get("/extensions", {
                params: { companyId },
            })
            const grouped = data.extensions as {
                sip?: { id: string; alias: string; name: string }[]
                pjsip?: { id: string; alias: string; name: string }[]
            }
            const extensions = [
                ...(grouped?.sip ?? []),
                ...(grouped?.pjsip ?? []),
            ]
            return extensions.map((e) => ({
                id: e.id,
                label: `${e.alias} - ${e.name}`,
            }))
        }
        case "queue": {
            const { data } = await api.get("/queues", { params: { companyId } })
            const queues = (data.queues ?? []) as {
                id: string
                name: string
                number: string
            }[]
            return queues.map((q) => ({
                id: q.id,
                label: `${q.name} (${q.number})`,
            }))
        }
        case "timecondition": {
            const { data } = await api.get("/time-conditions", {
                params: { companyId },
            })
            const timeConditions = (data.timeConditions ?? []) as {
                id: string
                name: string
            }[]
            return timeConditions.map((t) => ({ id: t.id, label: t.name }))
        }
        case "holiday": {
            const { data } = await api.get("/holiday-groups", {
                params: { companyId },
            })
            const holidayGroups = (data.holidayGroups ?? []) as {
                id: string
                name: string
            }[]
            return holidayGroups.map((h) => ({ id: h.id, label: h.name }))
        }
        case "announcement": {
            const { data } = await api.get("/announcements", {
                params: { companyId },
            })
            const announcements = (data.announcements ?? []) as {
                id: string
                name: string
                hasAudio: boolean
            }[]
            return announcements.map((a) => ({
                id: a.id,
                label: a.name,
                disabledReason: a.hasAudio ? undefined : "Sem áudio enviado",
            }))
        }
        case "ivr": {
            const { data } = await api.get("/ivr-menus", {
                params: { companyId },
            })
            const ivrMenus = (data.ivrMenus ?? []) as {
                id: string
                name: string
                hasAudio: boolean
            }[]
            return ivrMenus.map((i) => ({
                id: i.id,
                label: i.name,
                disabledReason: i.hasAudio ? undefined : "Sem áudio enviado",
            }))
        }
        case "request": {
            const { data } = await api.get("/request-templates", {
                params: { companyId },
            })
            const requestTemplates = (data.requestTemplates ?? []) as {
                id: string
                name: string
            }[]
            return requestTemplates.map((r) => ({ id: r.id, label: r.name }))
        }
        case "ixc": {
            const { data } = await api.get("/ixc-nodes", {
                params: { companyId },
            })
            const ixcNodes = (data.ixcNodes ?? []) as {
                id: string
                name: string
            }[]
            return ixcNodes.map((n) => ({ id: n.id, label: n.name }))
        }
        case "variable-set": {
            const { data } = await api.get("/variables", {
                params: { companyId },
            })
            const variableSets = (data.variableSets ?? []) as {
                id: string
                name: string
            }[]
            return variableSets.map((v) => ({ id: v.id, label: v.name }))
        }
        case "variable-condition": {
            const { data } = await api.get("/variable-conditions", {
                params: { companyId },
            })
            const variableConditions = (data.variableConditions ?? []) as {
                id: string
                name: string
            }[]
            return variableConditions.map((v) => ({ id: v.id, label: v.name }))
        }
        case "flow": {
            const { data } = await api.get("/flows", { params: { companyId } })
            const flows = (data.flows ?? []) as { id: string; name: string }[]
            return flows.map((f) => ({ id: f.id, label: f.name }))
        }
    }
}

function useDestinationOptions(type: RouteDestinationType, companyId: string) {
    const [options, setOptions] = useState<DestinationOption[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Zera antes de buscar — sem isso, ao trocar de tipo a lista antiga (ex: filas)
        // continua visível até a nova requisição resolver
        setOptions([])
        if (type === "hangup" || !companyId) {
            return
        }
        let cancelled = false
        setLoading(true)
        fetchDestinationOptions(type, companyId)
            .then((opts) => {
                if (!cancelled) setOptions(opts)
            })
            .catch((err) => {
                if (!cancelled)
                    toast.error(
                        apiError(err, "Erro ao buscar opções de destino")
                    )
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [type, companyId])

    return { options, loading }
}

type Props = {
    value: RouteDestination
    onChange: (destination: RouteDestination) => void
    companyId: string
    className?: string
    allowedTypes?: readonly RouteDestinationType[]
}

export function RouteDestinationField({
    value,
    onChange,
    companyId,
    className,
    allowedTypes = ROUTE_DEST_TYPES,
}: Props) {
    const type: RouteDestinationType = value?.type ?? "hangup"
    const id = value && "id" in value ? value.id : ""
    const { options, loading } = useDestinationOptions(type, companyId)
    const selectedOption = options.find((o) => o.id === id) ?? null

    function handleTypeChange(nextType: RouteDestinationType) {
        onChange(
            nextType === "hangup"
                ? { type: "hangup" }
                : { type: nextType, id: "" }
        )
    }

    function handleIdChange(nextId: string) {
        if (type === "hangup") return
        onChange({ type, id: nextId } as RouteDestination)
    }

    // hangup é o único tipo sem segundo campo (id) — nesse caso o select de tipo ocupa a linha
    // inteira em vez de dividir espaço com um campo vazio
    const hasIdField = type !== "hangup"
    // com um único tipo permitido não há o que escolher — mostra só o rótulo fixo em vez de
    // um select de opção única (ex: nó "Verificar horário" só aceita "timecondition")
    const singleType = allowedTypes.length === 1 ? allowedTypes[0] : null

    return (
        <div className={className}>
            <div className="flex flex-col gap-2 sm:flex-row">
                {singleType ? (
                    <div
                        className={cn(
                            "flex h-7 items-center gap-2 rounded-md border bg-muted/40 px-2 text-xs/relaxed",
                            hasIdField ? "sm:w-52" : "w-full"
                        )}
                    >
                        {(() => {
                            const Icon = ROUTE_DEST_ICONS[singleType]
                            return <Icon className="size-4 text-muted-foreground" />
                        })()}
                        {ROUTE_DEST_LABELS[singleType]}
                    </div>
                ) : (
                    <Select
                        items={SELECT_ITEMS}
                        value={type}
                        onValueChange={(v) =>
                            handleTypeChange(v as RouteDestinationType)
                        }
                    >
                        <SelectTrigger
                            className={cn("w-full", hasIdField && "sm:w-52")}
                        >
                            <span className="flex flex-1 items-center gap-2 overflow-hidden">
                                {(() => {
                                    const Icon = ROUTE_DEST_ICONS[type]
                                    return (
                                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                                    )
                                })()}
                                <SelectValue
                                    placeholder="Tipo de destino"
                                    className="truncate"
                                />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {allowedTypes.map((t) => {
                                const Icon = ROUTE_DEST_ICONS[t]
                                return (
                                    <SelectItem key={t} value={t}>
                                        <Icon /> {ROUTE_DEST_LABELS[t]}
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>
                )}

                {type !== "hangup" && (
                    // key={type} força remontar ao trocar de tipo — sem isso o combobox mantém
                    // o texto do item selecionado anteriormente (ex: nome da fila) mesmo depois
                    // de trocar pra um tipo sem nenhuma opção ainda
                    <Combobox<DestinationOption>
                        key={type}
                        items={options}
                        value={selectedOption}
                        itemToStringLabel={(o) => o.label}
                        isItemEqualToValue={(a, b) => a.id === b.id}
                        onValueChange={(opt) => handleIdChange(opt?.id ?? "")}
                    >
                        <ComboboxInput
                            placeholder={
                                loading
                                    ? "Carregando..."
                                    : `Buscar ${ROUTE_DEST_LABELS[type].toLowerCase()}...`
                            }
                            disabled={loading}
                            className="flex-1"
                        />
                        <ComboboxContent>
                            <ComboboxEmpty>
                                {loading
                                    ? "Carregando..."
                                    : options.length === 0
                                      ? ROUTE_DEST_EMPTY_MESSAGES[type]
                                      : "Nenhum resultado para essa busca"}
                            </ComboboxEmpty>
                            <ComboboxList>
                                {(opt: DestinationOption) => (
                                    <ComboboxItem
                                        key={opt.id}
                                        value={opt}
                                        disabled={!!opt.disabledReason}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {opt.label}
                                        </span>
                                        {opt.disabledReason && (
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                ({opt.disabledReason})
                                            </span>
                                        )}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                )}
            </div>
        </div>
    )
}
