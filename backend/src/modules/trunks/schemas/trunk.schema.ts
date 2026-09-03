import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

// Headers reservados pelo protocolo SIP - sobrescrever via PJSIP_HEADER quebraria o sinalização da chamada
const RESERVED_SIP_HEADERS = new Set([
    'via', 'from', 'to', 'call-id', 'cseq', 'contact', 'content-length', 'content-type', 'max-forwards',
])

// value é literal (sem interpolação de variável do Asterisk) - injetado via
// Set(PJSIP_HEADER(add,name)=value) antes do Dial() de saída (outbound-routes.service.ts)
export const customHeaderSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(40)
        .regex(/^[A-Za-z][A-Za-z0-9-]*$/, 'Only letters, digits and dash, starting with a letter')
        .refine((v) => !RESERVED_SIP_HEADERS.has(v.toLowerCase()), 'Reserved SIP header'),
    value: z.string().max(200).regex(/^[^"\\]*$/, 'Cannot contain double quotes or backslash'),
})

// Contextos gerenciados pela plataforma - um trunk custom não pode apontar pra eles, senão colide
// com o dialplan estático/realtime que os outros módulos já escrevem nesses nomes
const RESERVED_CONTEXTS = new Set([
    'ramais', 'from-trunk', 'from-trunk-routed', 'queues-app', 'timeconditions', 'holidays',
    'announcements', 'ivrs', 'request-templates', 'callcenter-surveys', 'variables', 'variable-conditions', 'vm',
])

export const customTrunkContextSchema = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_-]*$/i, 'Only letters, digits, dash and underscore, starting with a letter')
    .refine((v) => !RESERVED_CONTEXTS.has(v.toLowerCase()), 'Reserved context name')

const minimalTrunkShape = {
    name: z
        .string()
        .min(1)
        .max(20)
        .regex(/^[a-z0-9_-]+$/i, 'Only alphanumeric, dash and underscore allowed'),
    companyId: z.cuid2(),
}

// Só se aplica a type="pjsip" - sem equivalente em IAX2 (SIP headers, 100rel, session timers etc.)
const advancedTrunkShape = {
    transport: z.enum(['transport-udp', 'transport-tcp']).optional(),
    dtmfMode: z.enum(['rfc4733', 'inband', 'info', 'auto']).optional(),
    directMedia: z.boolean().optional(),
    qualifyFrequency: z.number().int().min(0).max(3600).optional(),
    qualifyTimeout: z.number().min(0).max(60).optional(),
    outboundProxy: z.string().max(40).optional(),
    iceSupport: z.boolean().optional(),
    rel: z.enum(['no', 'yes', 'required']).optional(),
    timers: z.enum(['no', 'yes', 'always']).optional(),
    timersMinSe: z.number().int().min(90).max(100000).optional(),
    timersSessExpires: z.number().int().min(90).max(100000).optional(),
    sendDiversion: z.boolean().optional(),
    customHeaders: z.array(customHeaderSchema).max(10).optional(),
}

// Só se aplica a type="iax" - espelha as diretivas do iax.conf (ver iax.repository.ts)
const iaxAdvancedShape = {
    qualify: z.enum(['yes', 'no']).optional(),
    trunkMode: z.boolean().optional(),
    encryption: z.boolean().optional(),
    transfer: z.enum(['yes', 'no', 'mediaonly']).optional(),
    jitterbuffer: z.boolean().optional(),
}

const baseTrunkShape = {
    ...minimalTrunkShape,
    type: z.enum(['pjsip', 'iax']).default('pjsip'),
    codecs: z.string().max(200).default('ulaw,alaw'),
    techPrefix: z.string().max(20).optional(),
    maxInChannels: z.number().int().min(1).optional(),
    maxOutChannels: z.number().int().min(1).optional(),
    ...advancedTrunkShape,
    ...iaxAdvancedShape,
}

const portShape = { port: z.number().int().min(1).max(65535).optional().default(5060) }

export const createTrunkSchema = z.discriminatedUnion('registrationMode', [
    z.object({
        ...baseTrunkShape,
        ...portShape,
        registrationMode: z.literal('outbound'),
        host: z.string().min(1).max(255),
        username: z.string().min(1).max(80),
        password: z.string().min(1).max(80),
    }),
    z.object({
        ...baseTrunkShape,
        ...portShape,
        registrationMode: z.literal('inbound'),
        host: z.string().min(1).max(255).optional(),
        username: z.string().min(1).max(80).optional(),
        password: z.string().min(1).max(80).optional(),
    }),
    // Sem endpoint PJSIP nenhum - ao ser usado numa Outbound Route, o Dial() vira um
    // Goto(context,${EXTEN},1) pro contexto informado (ver outbound-routes.service.ts). Não recebe
    // chamadas (sem InboundRoute possível) e nenhum campo de PJSIP/codec/canal se aplica.
    z.object({
        ...minimalTrunkShape,
        registrationMode: z.literal('custom'),
        context: customTrunkContextSchema,
    }),
])

export const updateTrunkSchema = z.object({
    host: z.string().min(1).max(255).optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    username: z.string().min(1).max(80).nullable().optional(),
    password: z.string().min(1).max(80).optional(),
    codecs: z.string().max(200).optional(),
    techPrefix: z.string().max(20).nullable().optional(),
    maxInChannels: z.number().int().min(1).nullable().optional(),
    maxOutChannels: z.number().int().min(1).nullable().optional(),
    transport: z.enum(['transport-udp', 'transport-tcp']).nullable().optional(),
    dtmfMode: z.enum(['rfc4733', 'inband', 'info', 'auto']).nullable().optional(),
    directMedia: z.boolean().nullable().optional(),
    qualifyFrequency: z.number().int().min(0).max(3600).nullable().optional(),
    qualifyTimeout: z.number().min(0).max(60).nullable().optional(),
    outboundProxy: z.string().max(40).nullable().optional(),
    iceSupport: z.boolean().nullable().optional(),
    rel: z.enum(['no', 'yes', 'required']).nullable().optional(),
    timers: z.enum(['no', 'yes', 'always']).nullable().optional(),
    timersMinSe: z.number().int().min(90).max(100000).nullable().optional(),
    timersSessExpires: z.number().int().min(90).max(100000).nullable().optional(),
    sendDiversion: z.boolean().nullable().optional(),
    customHeaders: z.array(customHeaderSchema).max(10).optional(),
    qualify: z.enum(['yes', 'no']).nullable().optional(),
    trunkMode: z.boolean().nullable().optional(),
    encryption: z.boolean().nullable().optional(),
    transfer: z.enum(['yes', 'no', 'mediaonly']).nullable().optional(),
    jitterbuffer: z.boolean().nullable().optional(),
    // Só aceito pelo service quando o trunk existente é registrationMode='custom'
    context: customTrunkContextSchema.optional(),
})

export const setTrunkActiveSchema = z.object({ active: z.boolean() })

export const trunkIdParamSchema = z.object({ id: z.cuid2() })
export const trunkQuerySchema = z.object({ companyId: z.cuid2() })

export type CreateTrunkInput = z.infer<typeof createTrunkSchema>
export type UpdateTrunkInput = z.infer<typeof updateTrunkSchema>

export const TrunkSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    type: z.enum(['pjsip', 'iax']),
    registrationMode: z.enum(['outbound', 'inbound', 'custom']),
    active: z.boolean(),
    identifyBy: z.enum(['ip', 'username']).nullable(),
    host: z.string().nullable(),
    port: z.number().nullable(),
    username: z.string().nullable(),
    password: z.string().nullable(),
    context: z.string(),
    codecs: z.string(),
    techPrefix: z.string().nullable(),
    maxInChannels: z.number().nullable(),
    maxOutChannels: z.number().nullable(),
    transport: z.string().nullable(),
    dtmfMode: z.string().nullable(),
    directMedia: z.boolean().nullable(),
    qualifyFrequency: z.number().nullable(),
    qualifyTimeout: z.number().nullable(),
    outboundProxy: z.string().nullable(),
    iceSupport: z.boolean().nullable(),
    rel: z.string().nullable(),
    timers: z.string().nullable(),
    timersMinSe: z.number().nullable(),
    timersSessExpires: z.number().nullable(),
    sendDiversion: z.boolean().nullable(),
    customHeaders: z.array(z.object({ name: z.string(), value: z.string() })),
    qualify: z.string().nullable(),
    trunkMode: z.boolean().nullable(),
    encryption: z.boolean().nullable(),
    transfer: z.string().nullable(),
    jitterbuffer: z.boolean().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListTrunksResponse = ok({ message: z.string(), trunks: z.array(TrunkSchema) })
export const GetTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const CreateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const UpdateTrunkResponse = ok({ message: z.string(), trunk: TrunkSchema })
export const SetTrunkActiveResponse = ok({ message: z.string(), trunk: TrunkSchema })
