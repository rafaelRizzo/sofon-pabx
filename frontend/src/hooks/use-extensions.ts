"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type ExtensionType = "sip" | "pjsip"

export type ExportedExtension = {
    id: string
    alias: string
    username: string
    name: string
    type: ExtensionType
    companyId: string
    password: string
}

export type Extension = {
    id: string
    alias: string
    username: string
    name: string
    type: ExtensionType
    companyId: string
    context: string
    allowOutbound: boolean
    usedBy: UsedByRef[]
    notes: string | null
    createdAt: string
    updatedAt: string
    // SIP optional
    host?: string
    peerType?: string
    nat?: string
    qualify?: string
    callerId?: string
    defaultUser?: string
    permit?: string
    deny?: string
    insecure?: string
    callGroup?: string
    pickupGroup?: string
    accountCode?: string
    // PJSIP optional
    directMedia?: string | boolean
    forceRport?: boolean
    iceSupport?: boolean
    rewriteContact?: boolean
    rtpSymmetric?: boolean
    sendDiversion?: boolean
    allowTransfer?: boolean
    allowSubscribe?: string | boolean
    oneTouchRecording?: boolean
    webrtc?: boolean
    [key: string]: unknown
}

const aliasSchema = z.string().regex(/^\d{2,6}$/, "2 a 6 dígitos numéricos")

const optInt = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().optional()
)
const optFloat = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().optional()
)

// Campos SIP opcionais (espelha o backend)
const sipOptional = {
    host: z.string().max(40).optional(),
    peerType: z.enum(["friend", "peer", "user"]).optional(),
    nat: z.string().max(40).optional(),
    qualify: z.string().max(10).optional(),
    disallow: z.string().max(200).optional(),
    allow: z.string().max(200).optional(),
    insecure: z.string().max(40).optional(),
    transport: z.string().max(10).optional(),
    callerId: z.string().max(40).optional(),
    defaultUser: z.string().max(40).optional(),
    permit: z.string().max(95).optional(),
    deny: z.string().max(95).optional(),
    md5Secret: z.string().max(40).optional(),
    remoteSecret: z.string().max(40).optional(),
    callGroup: z.string().max(40).optional(),
    pickupGroup: z.string().max(40).optional(),
    accountCode: z.string().max(40).optional(),
    fromUser: z.string().max(40).optional(),
    fromDomain: z.string().max(40).optional(),
    trustRpid: z.string().max(10).optional(),
    progressInBand: z.string().max(10).optional(),
    promiscRedir: z.string().max(10).optional(),
    useClientCode: z.string().max(10).optional(),
    setVar: z.string().max(200).optional(),
    amaFlags: z.string().max(40).optional(),
    callCounter: z.string().max(10).optional(),
    busyLevel: optInt,
    allowOverlap: z.string().max(10).optional(),
    allowSubscribe: z.string().max(10).optional(),
    videoSupport: z.string().max(10).optional(),
    maxCallBitrate: optInt,
    rfc2833Compensate: z.string().max(10).optional(),
    sessionTimers: z.string().max(10).optional(),
    sessionExpires: optInt,
    sessionMinse: optInt,
    sessionRefresher: z.string().max(10).optional(),
    t38ptUsertpsource: z.string().max(10).optional(),
    regExten: z.string().max(40).optional(),
    defaultIp: z.string().max(45).optional(),
    rtpTimeout: optInt,
    rtpHoldTimeout: optInt,
    sendRpid: z.string().max(10).optional(),
    outboundProxy: z.string().max(40).optional(),
    callbackExtension: z.string().max(40).optional(),
    timerT1: optInt,
    timerB: optInt,
    qualifyFreq: optInt,
    constantsSrc: z.string().max(10).optional(),
    contactPermit: z.string().max(95).optional(),
    contactDeny: z.string().max(95).optional(),
    useReqPhone: z.string().max(10).optional(),
    textSupport: z.string().max(10).optional(),
    faxDetect: z.string().max(10).optional(),
    buggyMwi: z.string().max(10).optional(),
    auth: z.string().max(40).optional(),
    fullName: z.string().max(40).optional(),
    trunkName: z.string().max(40).optional(),
    cidNumber: z.string().max(40).optional(),
    callingPres: z.string().max(20).optional(),
    mohInterpret: z.string().max(40).optional(),
    mohSuggest: z.string().max(40).optional(),
    parkingLot: z.string().max(40).optional(),
    autoFraming: z.string().max(10).optional(),
    rtpKeepalive: optInt,
    dtmfMode: z.string().max(10).optional(),
    directMedia: z.string().max(10).optional(),
    language: z.string().max(40).optional(),
}

// Campos PJSIP opcionais (espelha o backend)
const pjsipOptional = {
    transport: z.string().max(40).optional(),
    disallow: z.string().max(200).optional(),
    allow: z.string().max(200).optional(),
    directMedia: z.boolean().optional(),
    dtmfMode: z.string().max(40).optional(),
    forceRport: z.boolean().optional(),
    iceSupport: z.boolean().optional(),
    rewriteContact: z.boolean().optional(),
    rtpSymmetric: z.boolean().optional(),
    sendDiversion: z.boolean().optional(),
    timers: z.string().max(40).optional(),
    timersMinSe: optInt,
    timersSessExpires: optInt,
    language: z.string().max(10).optional(),
    oneTouchRecording: z.boolean().optional(),
    allowTransfer: z.boolean().optional(),
    allowSubscribe: z.boolean().optional(),
    fromUser: z.string().max(40).optional(),
    fromDomain: z.string().max(40).optional(),
    outboundProxy: z.string().max(40).optional(),
    mohSuggest: z.string().max(40).optional(),
    rel: z.string().max(40).optional(),
    aorMaxContacts: optInt,
    aorQualifyFrequency: optInt,
    aorQualifyTimeout: optFloat,
    aorMinimumExpiration: optInt,
    aorMaximumExpiration: optInt,
    aorDefaultExpiration: optInt,
    aorRemoveExisting: z.boolean().optional(),
    aorAuthenticateQualify: z.boolean().optional(),
    aorSupportPath: z.boolean().optional(),
    aorOutboundProxy: z.string().max(40).optional(),
    namedCallGroup: z.string().max(80).optional(),
    namedPickupGroup: z.string().max(80).optional(),
    // Shortcut nativo do PJSIP (ICE + DTLS-SRTP + rtcp_mux) - liga o ramal pro softphone WebRTC
    webrtc: z.boolean().optional(),
}

// Schema plano para o form (union de campos - frontend filtra por tipo no submit)
const commonFields = {
    alias: aliasSchema,
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione a empresa"),
    // Fixo em "ramais" (não editável) - ver comentário em createExtensionSchema do backend
    context: z.literal("ramais").default("ramais"),
    allowOutbound: z.boolean().default(true),
    notes: z.string().max(10000, "Máximo de 10.000 caracteres").optional(),
}

export const createExtensionSchema = z.object({
    type: z.enum(["sip", "pjsip"], { message: "Selecione o tipo" }),
    ...commonFields,
    // SIP-only
    ...sipOptional,
    // PJSIP-only extras (campos que não existem em SIP)
    forceRport: z.boolean().optional(),
    iceSupport: z.boolean().optional(),
    rewriteContact: z.boolean().optional(),
    rtpSymmetric: z.boolean().optional(),
    sendDiversion: z.boolean().optional(),
    timers: z.string().max(40).optional(),
    timersMinSe: optInt,
    timersSessExpires: optInt,
    oneTouchRecording: z.boolean().optional(),
    allowTransfer: z.boolean().optional(),
    rel: z.string().max(40).optional(),
    aorMaxContacts: optInt,
    aorQualifyFrequency: optInt,
    aorQualifyTimeout: optFloat,
    aorMinimumExpiration: optInt,
    aorMaximumExpiration: optInt,
    aorDefaultExpiration: optInt,
    aorRemoveExisting: z.boolean().optional(),
    aorAuthenticateQualify: z.boolean().optional(),
    aorSupportPath: z.boolean().optional(),
    aorOutboundProxy: z.string().max(40).optional(),
    namedCallGroup: z.string().max(80).optional(),
    namedPickupGroup: z.string().max(80).optional(),
    webrtc: z.boolean().optional(),
    // Campos conflitantes: SIP=string, PJSIP=boolean (union)
    directMedia: z.union([z.string().max(10), z.boolean()]).optional(),
    allowSubscribe: z.union([z.string().max(10), z.boolean()]).optional(),
    // transport: SIP usa "udp"/"tcp" (curto), PJSIP referencia nome de seção em pjsip.conf
    // (ex: "transport-udp") - usa o limite mais permissivo, igual updateExtensionSchema
    transport: z.string().max(40).optional(),
})

export const updateExtensionSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    alias: aliasSchema,
    allowOutbound: z.boolean(),
    notes: z.string().max(10000, "Máximo de 10.000 caracteres").optional(),
    ...sipOptional,
    ...pjsipOptional,
    directMedia: z.union([z.string().max(10), z.boolean()]).optional(),
    allowSubscribe: z.union([z.string().max(10), z.boolean()]).optional(),
})

export type ExtensionCreateForm = z.infer<typeof createExtensionSchema>
export type ExtensionUpdateForm = z.infer<typeof updateExtensionSchema>

// Chaves exclusivas de cada protocolo - usadas para filtrar o payload no create
const SIP_KEYS = new Set(Object.keys(sipOptional))
const PJSIP_KEYS = new Set(Object.keys(pjsipOptional))
const COMMON_KEYS = new Set([
    "type",
    "alias",
    "name",
    "companyId",
    "context",
    "allowOutbound",
    "notes",
])

async function fetchExtensionsRequest(companyId: string): Promise<Extension[]> {
    const { data } = await api.get("/extensions", { params: { companyId } })
    return [...(data.extensions?.sip ?? []), ...(data.extensions?.pjsip ?? [])]
}

export function useExtensions(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: extensions = [], isLoading: loading } = useQuery({
        queryKey: ["extensions", companyId],
        queryFn: () => fetchExtensionsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["extensions"] })

    const getExtensionById = useCallback(
        async (id: string): Promise<Extension | null> => {
            try {
                const { data } = await api.get(`/extensions/${id}`)
                return data.extension || data
            } catch (err) {
                toast.error(apiError(err, "Erro ao buscar ramal"))
                return null
            }
        },
        []
    )

    const createExtension = async (
        form: ExtensionCreateForm
    ): Promise<{ password: string; username: string } | null> => {
        const id = toast.loading("Criando ramal...")
        try {
            const allowedKeys =
                form.type === "sip"
                    ? (k: string) => COMMON_KEYS.has(k) || SIP_KEYS.has(k)
                    : (k: string) => COMMON_KEYS.has(k) || PJSIP_KEYS.has(k)

            const payload = Object.fromEntries(
                Object.entries(form).filter(
                    ([k, v]) => allowedKeys(k) && v !== undefined && v !== ""
                )
            )

            const { data } = await api.post("/extensions", payload)
            toast.success("Ramal criado", { id })
            await invalidate()
            return {
                password: data.extension?.password ?? "",
                username: data.extension?.username ?? "",
            }
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar ramal"), { id })
            return null
        }
    }

    const updateExtension = async (
        extensionId: string,
        form: ExtensionUpdateForm
    ) => {
        const id = toast.loading("Atualizando ramal...")
        try {
            // Enviar apenas campos preenchidos
            const payload = Object.fromEntries(
                Object.entries(form).filter(
                    ([, v]) => v !== undefined && v !== ""
                )
            )
            await api.put(`/extensions/${extensionId}`, payload)
            toast.success("Ramal atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar ramal"), { id })
            return false
        }
    }

    const resetPassword = async (
        extensionId: string
    ): Promise<string | null> => {
        const id = toast.loading("Resetando senha...")
        try {
            const { data } = await api.patch(
                `/extensions/${extensionId}/password`,
                {}
            )
            toast.success("Senha resetada", { id })
            return data.password ?? null
        } catch (err) {
            toast.error(apiError(err, "Erro ao resetar senha"), { id })
            return null
        }
    }

    const exportExtensions = async (
        companyId?: string
    ): Promise<ExportedExtension[] | null> => {
        const id = toast.loading("Gerando export...")
        try {
            const { data } = await api.get("/extensions/export", {
                params: companyId ? { companyId } : undefined,
            })
            toast.success("Export gerado", { id })
            return data.extensions ?? []
        } catch (err) {
            toast.error(apiError(err, "Erro ao exportar ramais"), { id })
            return null
        }
    }

    const deleteExtension = async (extensionId: string) => {
        const id = toast.loading("Deletando ramal...")
        try {
            await api.delete(`/extensions/${extensionId}`)
            toast.success("Ramal deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar ramal"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            extensions.filter((e) =>
                `${e.alias} ${e.name} ${e.username}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            ),
        [extensions, filter]
    )

    return {
        extensions: filtered,
        loading,
        filter,
        setFilter,
        fetchExtensions: invalidate,
        createExtension,
        updateExtension,
        resetPassword,
        deleteExtension,
        getExtensionById,
        exportExtensions,
    }
}
