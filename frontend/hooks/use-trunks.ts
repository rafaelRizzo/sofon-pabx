"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type RegistrationMode = "outbound" | "inbound" | "custom"

export type TrunkType = "pjsip" | "iax"

export type IdentifyBy = "ip" | "username"

export type CustomHeader = { name: string; value: string }

export type Trunk = {
    id: string
    name: string
    companyId: string
    type: TrunkType
    registrationMode: RegistrationMode
    // Derivado pelo backend a partir de username (inbound: "username" se informado, senão "ip"; outbound: sempre null)
    // — não é enviado no create/update; no PUT inbound, enviar username muda para "username", enviar username: null volta para "ip"
    identifyBy: IdentifyBy | null
    host: string | null
    port: number | null
    username: string | null
    password: string | null
    context: string
    codecs: string
    maxInChannels: number | null
    maxOutChannels: number | null
    transport: string | null
    dtmfMode: string | null
    directMedia: boolean | null
    qualifyFrequency: number | null
    qualifyTimeout: number | null
    outboundProxy: string | null
    iceSupport: boolean | null
    rel: string | null
    timers: string | null
    timersMinSe: number | null
    timersSessExpires: number | null
    sendDiversion: boolean | null
    customHeaders: CustomHeader[]
    qualify: string | null
    trunkMode: boolean | null
    encryption: boolean | null
    transfer: string | null
    jitterbuffer: boolean | null
    createdAt: string
    updatedAt: string
}

const optChannels = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1, "Mínimo 1").optional()
)

const optPort = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1, "Mínimo 1").max(65535, "Máximo 65535").optional()
)

// Só no create: campo vazio deve virar 5060, não ficar sem porta. No update, campo vazio
// continua significando "sem alteração" (usa optPort, sem default).
const optPortWithDefault = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z
        .number()
        .int()
        .min(1, "Mínimo 1")
        .max(65535, "Máximo 65535")
        .optional()
        .default(5060)
)

const optQualifyFrequency = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(0, "Mínimo 0").max(3600, "Máximo 3600").optional()
)

const optQualifyTimeout = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(0, "Mínimo 0").max(60, "Máximo 60").optional()
)

const optSessionTimer = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z
        .number()
        .int()
        .min(90, "Mínimo 90")
        .max(100000, "Máximo 100000")
        .optional()
)

// Espelha RESERVED_SIP_HEADERS/customHeaderSchema de backend/src/modules/trunks/schemas/trunk.schema.ts
const RESERVED_SIP_HEADERS = new Set([
    "via",
    "from",
    "to",
    "call-id",
    "cseq",
    "contact",
    "content-length",
    "content-type",
    "max-forwards",
])

const customHeaderFieldSchema = z.object({
    name: z
        .string()
        .min(1, "Informe o nome")
        .max(40, "Máximo 40 caracteres")
        .regex(
            /^[A-Za-z][A-Za-z0-9-]*$/,
            "Use letras, dígitos e - (começando com letra)"
        )
        .refine(
            (v) => !RESERVED_SIP_HEADERS.has(v.toLowerCase()),
            "Header reservado pelo SIP"
        ),
    value: z
        .string()
        .max(200, "Máximo 200 caracteres")
        .regex(/^[^"\\]*$/, "Não pode conter aspas duplas ou barra invertida"),
})

// Espelha RESERVED_CONTEXTS/customTrunkContextSchema de backend/src/modules/trunks/schemas/trunk.schema.ts
const RESERVED_CONTEXTS = new Set([
    "ramais",
    "from-trunk",
    "from-trunk-routed",
    "queues-app",
    "timeconditions",
    "holidays",
    "announcements",
    "ivrs",
    "request-templates",
    "callcenter-surveys",
    "variables",
    "variable-conditions",
    "vm",
])

const customTrunkContextFieldSchema = z
    .string()
    .min(1, "Informe o contexto")
    .max(40, "Máximo 40 caracteres")
    .regex(
        /^[a-z][a-z0-9_-]*$/i,
        "Use letras, dígitos, - e _ (começando com letra)"
    )
    .refine(
        (v) => !RESERVED_CONTEXTS.has(v.toLowerCase()),
        "Contexto reservado pela plataforma"
    )

const minimalTrunkFields = {
    name: z
        .string()
        .min(1, "Informe o nome")
        .max(20, "Máximo 20 caracteres")
        .regex(/^[a-z0-9_-]+$/i, "Apenas letras, números, - e _"),
    companyId: z.string().min(1, "Selecione a empresa"),
}

// Espelha advancedTrunkShape de backend/src/modules/trunks/schemas/trunk.schema.ts
const advancedTrunkFields = {
    transport: z.enum(["transport-udp", "transport-tcp"]).optional(),
    dtmfMode: z.enum(["rfc4733", "inband", "info", "auto"]).optional(),
    directMedia: z.boolean().optional(),
    qualifyFrequency: optQualifyFrequency,
    qualifyTimeout: optQualifyTimeout,
    outboundProxy: z.string().max(40, "Máximo 40 caracteres").optional(),
    iceSupport: z.boolean().optional(),
    rel: z.enum(["no", "yes", "required"]).optional(),
    timers: z.enum(["no", "yes", "always"]).optional(),
    timersMinSe: optSessionTimer,
    timersSessExpires: optSessionTimer,
    sendDiversion: z.boolean().optional(),
    customHeaders: z
        .array(customHeaderFieldSchema)
        .max(10, "Máximo 10 headers")
        .optional(),
}

// Espelha iaxAdvancedShape de backend/src/modules/trunks/schemas/trunk.schema.ts
const iaxTrunkFields = {
    qualify: z.enum(["yes", "no"]).optional(),
    trunkMode: z.boolean().optional(),
    encryption: z.boolean().optional(),
    transfer: z.enum(["yes", "no", "mediaonly"]).optional(),
    jitterbuffer: z.boolean().optional(),
}

// Espelha baseTrunkShape de backend/src/modules/trunks/schemas/trunk.schema.ts
const baseTrunkFields = {
    ...minimalTrunkFields,
    type: z.enum(["pjsip", "iax"]).default("pjsip"),
    codecs: z.string().max(200).default("ulaw,alaw"),
    maxInChannels: optChannels,
    maxOutChannels: optChannels,
    port: optPortWithDefault,
    ...advancedTrunkFields,
    ...iaxTrunkFields,
}

export const createTrunkSchema = z.discriminatedUnion("registrationMode", [
    z.object({
        ...baseTrunkFields,
        registrationMode: z.literal("outbound"),
        host: z.string().min(1, "Informe o host").max(255),
        username: z.string().min(1, "Informe o usuário").max(80),
        password: z.string().min(1, "Informe a senha").max(80),
    }),
    z.object({
        ...baseTrunkFields,
        registrationMode: z.literal("inbound"),
        host: z.string().max(255).optional(),
        username: z.string().max(80).optional(),
        password: z.string().max(80).optional(),
    }),
    // Sem PJSIP nenhum — vira Goto(context,...) na Outbound Route, sem receber chamadas
    z.object({
        ...minimalTrunkFields,
        registrationMode: z.literal("custom"),
        context: customTrunkContextFieldSchema,
    }),
])

export const updateTrunkSchema = z.object({
    host: z.string().max(255).optional(),
    port: optPort,
    username: z.string().max(80).optional(),
    password: z.string().max(80).optional(),
    codecs: z.string().max(200).optional(),
    maxInChannels: optChannels,
    maxOutChannels: optChannels,
    ...advancedTrunkFields,
    ...iaxTrunkFields,
    // Só aceito pelo backend quando o trunk existente é registrationMode="custom"
    context: customTrunkContextFieldSchema.optional(),
})

export type TrunkCreateForm = z.infer<typeof createTrunkSchema>
export type TrunkUpdateForm = z.infer<typeof updateTrunkSchema>

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useTrunks(companyId?: string) {
    const [trunks, setTrunks] = useState<Trunk[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchTrunks = useCallback(async () => {
        if (!companyId) {
            setTrunks([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/trunks", { params: { companyId } })
            setTrunks(data.trunks ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar troncos"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createTrunk = async (
        form: TrunkCreateForm
    ): Promise<Trunk | null> => {
        const id = toast.loading("Criando tronco...")
        try {
            // Campos opcionais (host/username/password no inbound) exigem
            // min(1) no backend quando informados — "" precisa virar omissão
            const payload = Object.fromEntries(
                Object.entries(form).filter(
                    ([, v]) => v !== undefined && v !== ""
                )
            )
            const { data } = await api.post("/trunks", payload)
            toast.success("Tronco criado", { id })
            await fetchTrunks()
            return data.trunk ?? null
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar tronco"), { id })
            return null
        }
    }

    const updateTrunk = async (trunkId: string, form: TrunkUpdateForm) => {
        const id = toast.loading("Atualizando tronco...")
        try {
            const payload = Object.fromEntries(
                Object.entries(form).filter(
                    ([, v]) => v !== undefined && v !== ""
                )
            )
            await api.put(`/trunks/${trunkId}`, payload)
            toast.success("Tronco atualizado", { id })
            await fetchTrunks()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar tronco"), { id })
            return false
        }
    }

    const deleteTrunk = async (trunkId: string) => {
        const id = toast.loading("Deletando tronco...")
        try {
            await api.delete(`/trunks/${trunkId}`)
            toast.success("Tronco deletado", { id })
            await fetchTrunks()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar tronco"), { id })
            return false
        }
    }

    const filtered = trunks.filter((t) =>
        `${t.name} ${t.host ?? ""}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({
        fetched: false,
    })

    useEffect(() => {
        if (
            fetchStateRef.current.fetched &&
            fetchStateRef.current.key === companyId
        )
            return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchTrunks()
    }, [fetchTrunks, companyId])

    return {
        trunks: filtered,
        loading,
        filter,
        setFilter,
        fetchTrunks,
        createTrunk,
        updateTrunk,
        deleteTrunk,
    }
}
