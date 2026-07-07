import { z } from 'zod'
import { timestamp, ok } from '../../../schemas/responses'

const aliasSchema = z.string().regex(/^\d{2,6}$/, 'Must be 2-6 digits')

export const extensionIdParamSchema = z.object({
    id: z.cuid2(),
})

export const extensionQuerySchema = z.object({
    companyId: z.cuid2(),
})

// ─── SIP-only fields (sip_peers) ─────────────────────────────────────────────
const sipFields = {
    host: z.string().max(40).optional(),
    port: z.string().max(6).optional(),
    peerType: z.enum(['friend', 'peer', 'user']).optional(),
    nat: z.string().max(40).optional(),
    dtmfMode: z.string().max(10).optional(),
    directMedia: z.string().max(10).optional(),
    language: z.string().max(40).optional(),
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
    busyLevel: z.number().int().min(0).max(100).optional(),
    allowOverlap: z.string().max(10).optional(),
    allowSubscribe: z.string().max(10).optional(),
    videoSupport: z.string().max(10).optional(),
    maxCallBitrate: z.number().int().min(0).max(10000).optional(),
    rfc2833Compensate: z.string().max(10).optional(),
    sessionTimers: z.string().max(10).optional(),
    sessionExpires: z.number().int().min(90).max(86400).optional(),
    sessionMinse: z.number().int().min(90).max(86400).optional(),
    sessionRefresher: z.string().max(10).optional(),
    regExten: z.string().max(40).optional(),
    defaultIp: z.string().max(45).optional(),
    rtpTimeout: z.number().int().min(0).max(3600).optional(),
    rtpHoldTimeout: z.number().int().min(0).max(3600).optional(),
    sendRpid: z.string().max(10).optional(),
    outboundProxy: z.string().max(40).optional(),
    callbackExtension: z.string().max(40).optional(),
    timerT1: z.number().int().min(1).max(5000).optional(),
    timerB: z.number().int().min(1).max(64000).optional(),
    qualifyFreq: z.number().int().min(1).max(3600).optional(),
    constantsSrc: z.string().max(10).optional(),
    contactPermit: z.string().max(95).optional(),
    contactDeny: z.string().max(95).optional(),
    useReqPhone: z.string().max(10).optional(),
    textSupport: z.string().max(10).optional(),
    auth: z.string().max(40).optional(),
    fullName: z.string().max(40).optional(),
    trunkName: z.string().max(40).optional(),
    cidNumber: z.string().max(40).optional(),
    callingPres: z.string().max(20).optional(),
    mohInterpret: z.string().max(40).optional(),
    mohSuggest: z.string().max(40).optional(),
    parkingLot: z.string().max(40).optional(),
    subscribeContext: z.string().max(80).optional(),
    autoFraming: z.string().max(10).optional(),
    rtpKeepalive: z.number().int().min(0).max(3600).optional(),
}

// md5Secret/remoteSecret são credenciais alternativas do chan_sip — graváveis só no create,
// nunca devem voltar num GET (response) nem entrar no merge de detalhes lido do sip_peers
const { md5Secret: _md5Secret, remoteSecret: _remoteSecret, ...sipFieldsPublic } = sipFields

// ─── PJSIP-only fields (ps_endpoints + ps_aors via aor_ prefix) ──────────────
const pjsipFields = {
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
    timersMinSe: z.number().int().min(90).max(86400).optional(),
    timersSessExpires: z.number().int().min(90).max(86400).optional(),
    language: z.string().max(10).optional(),
    oneTouchRecording: z.boolean().optional(),
    allowTransfer: z.boolean().optional(),
    allowSubscribe: z.boolean().optional(),
    fromUser: z.string().max(40).nullish(),
    fromDomain: z.string().max(40).nullish(),
    outboundProxy: z.string().max(40).nullish(),
    mohSuggest: z.string().max(40).optional(),
    rel: z.string().max(40).optional(),
    // ps_aors (aor prefix)
    aorMaxContacts: z.number().int().min(1).max(20).optional(),
    aorQualifyFrequency: z.number().int().min(0).max(3600).optional(),
    aorQualifyTimeout: z.number().min(0).max(60).optional(),
    aorMinimumExpiration: z.number().int().min(1).max(604800).optional(),
    aorMaximumExpiration: z.number().int().min(1).max(604800).optional(),
    aorDefaultExpiration: z.number().int().min(1).max(604800).optional(),
    aorRemoveExisting: z.boolean().optional(),
    aorAuthenticateQualify: z.boolean().optional(),
    aorSupportPath: z.boolean().optional(),
    aorOutboundProxy: z.string().max(40).nullish(),
    // user informs logical name(s), e.g. "suporte" or "suporte,financeiro"
    // service prefixes with asteriskId before writing to ps_endpoints
    namedCallGroup: z.string().max(80).optional(),
    namedPickupGroup: z.string().max(80).optional(),
}

const baseShape = {
    alias: aliasSchema,
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    context: z.string().max(40).default('ramais'),
    allowOutbound: z.boolean().default(true),
}

// Defaults sensatos de chan_sip pra um ramal comum — só no create; update usa sipFields sem default
// pra não sobrescrever quando o campo é omitido (ver sipFieldsForUpdate abaixo)
const sipCreateDefaults = {
    host: sipFields.host.default('dynamic'),
    peerType: sipFields.peerType.default('friend'),
    nat: sipFields.nat.default('force_rport,comedia'),
    dtmfMode: sipFields.dtmfMode.default('rfc2833'),
    directMedia: sipFields.directMedia.default('no'),
    qualify: sipFields.qualify.default('yes'),
    disallow: sipFields.disallow.default('all'),
    allow: sipFields.allow.default('ulaw,alaw'),
    insecure: sipFields.insecure.default('port,invite'),
    transport: sipFields.transport.default('udp'),
    callCounter: sipFields.callCounter.default('yes'),
    allowOverlap: sipFields.allowOverlap.default('no'),
    allowSubscribe: sipFields.allowSubscribe.default('yes'),
    videoSupport: sipFields.videoSupport.default('no'),
    sessionTimers: sipFields.sessionTimers.default('accept'),
    sessionExpires: sipFields.sessionExpires.default(1800),
    sessionMinse: sipFields.sessionMinse.default(90),
    sessionRefresher: sipFields.sessionRefresher.default('uas'),
    qualifyFreq: sipFields.qualifyFreq.default(60),
    rtpKeepalive: sipFields.rtpKeepalive.default(0),
}

// Defaults espelham os @default de ps_endpoints/ps_aors no schema.prisma — só no create; update usa
// pjsipFields sem default pra não sobrescrever quando o campo é omitido
const pjsipCreateDefaults = {
    transport: pjsipFields.transport.default('transport-udp'),
    disallow: pjsipFields.disallow.default('all'),
    allow: pjsipFields.allow.default('ulaw,alaw'),
    directMedia: pjsipFields.directMedia.default(false),
    dtmfMode: pjsipFields.dtmfMode.default('rfc4733'),
    forceRport: pjsipFields.forceRport.default(true),
    iceSupport: pjsipFields.iceSupport.default(false),
    rewriteContact: pjsipFields.rewriteContact.default(true),
    rtpSymmetric: pjsipFields.rtpSymmetric.default(true),
    sendDiversion: pjsipFields.sendDiversion.default(true),
    timers: pjsipFields.timers.default('yes'),
    timersMinSe: pjsipFields.timersMinSe.default(90),
    timersSessExpires: pjsipFields.timersSessExpires.default(1800),
    language: pjsipFields.language.default('pt_BR'),
    oneTouchRecording: pjsipFields.oneTouchRecording.default(false),
    allowTransfer: pjsipFields.allowTransfer.default(true),
    allowSubscribe: pjsipFields.allowSubscribe.default(true),
    mohSuggest: pjsipFields.mohSuggest.default('default'),
    rel: pjsipFields.rel.default('yes'),
    aorMaxContacts: pjsipFields.aorMaxContacts.default(1),
    aorQualifyFrequency: pjsipFields.aorQualifyFrequency.default(60),
    aorQualifyTimeout: pjsipFields.aorQualifyTimeout.default(3),
    aorMinimumExpiration: pjsipFields.aorMinimumExpiration.default(60),
    aorMaximumExpiration: pjsipFields.aorMaximumExpiration.default(7200),
    aorDefaultExpiration: pjsipFields.aorDefaultExpiration.default(3600),
    aorRemoveExisting: pjsipFields.aorRemoveExisting.default(true),
    aorAuthenticateQualify: pjsipFields.aorAuthenticateQualify.default(false),
    aorSupportPath: pjsipFields.aorSupportPath.default(false),
}

export const createExtensionSchema = z.discriminatedUnion('type', [
    z.object({ ...baseShape, type: z.literal('sip'), ...sipFields, ...sipCreateDefaults }).strict(),
    z.object({ ...baseShape, type: z.literal('pjsip'), ...pjsipFields, ...pjsipCreateDefaults }).strict(),
])

// accountCode é sempre = company.asteriskId, controlado 100% pelo server (ver extensions.service.ts) —
// aceito no create (sobrescrito, então enviar é inofensivo) mas nunca editável via update.
// md5Secret/remoteSecret: credenciais alternativas do chan_sip — editáveis só no create, nunca no update
const {
    accountCode: _accountCodeNotEditable,
    md5Secret: _md5SecretNotEditable,
    remoteSecret: _remoteSecretNotEditable,
    ...sipFieldsForUpdate
} = sipFields

export const updateExtensionSchema = z
    .object({
        name: z.string().min(1).max(80).optional(),
        alias: aliasSchema.optional(),
        context: z.string().max(40).optional(),
        allowOutbound: z.boolean().optional(),
        ...sipFieldsForUpdate,
        ...pjsipFields,
        // shared fields — use most permissive constraint
        language: z.string().max(40).optional(),
        transport: z.string().max(40).optional(),
        fromUser: z.string().max(40).nullish(),
        fromDomain: z.string().max(40).nullish(),
        outboundProxy: z.string().max(40).nullish(),
        mohSuggest: z.string().max(40).optional(),
        dtmfMode: z.string().max(40).optional(),
        directMedia: z.union([z.string().max(10), z.boolean()]).optional(),
        allowSubscribe: z.union([z.string().max(10), z.boolean()]).optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field is required: name, alias, context, allowOutbound, or type-specific SIP/PJSIP fields',
    })

// ─── Mapping: camelCase API → Asterisk DB column names ───────────────────────

export const sipFieldMap: Record<string, string> = {
    peerType: 'type',
    dtmfMode: 'dtmfmode',
    directMedia: 'directmedia',
    callerId: 'callerid',
    defaultUser: 'defaultuser',
    md5Secret: 'md5secret',
    remoteSecret: 'remotesecret',
    callGroup: 'callgroup',
    pickupGroup: 'pickupgroup',
    accountCode: 'accountcode',
    fromUser: 'fromuser',
    fromDomain: 'fromdomain',
    trustRpid: 'trustrpid',
    progressInBand: 'progressinband',
    promiscRedir: 'promiscredir',
    useClientCode: 'useclientcode',
    setVar: 'setvar',
    amaFlags: 'amaflags',
    callCounter: 'callcounter',
    busyLevel: 'busylevel',
    allowOverlap: 'allowoverlap',
    allowSubscribe: 'allowsubscribe',
    videoSupport: 'videosupport',
    maxCallBitrate: 'maxcallbitrate',
    rfc2833Compensate: 'rfc2833compensate',
    sessionTimers: 'sessiontimers',
    sessionExpires: 'sessionexpires',
    sessionMinse: 'sessionminse',
    sessionRefresher: 'sessionrefresher',
    regExten: 'regexten',
    defaultIp: 'defaultip',
    rtpTimeout: 'rtptimeout',
    rtpHoldTimeout: 'rtpholdtimeout',
    sendRpid: 'sendrpid',
    outboundProxy: 'outboundproxy',
    callbackExtension: 'callbackextension',
    timerT1: 'timert1',
    timerB: 'timerb',
    qualifyFreq: 'qualifyfreq',
    constantsSrc: 'constantssrc',
    contactPermit: 'contactpermit',
    contactDeny: 'contactdeny',
    useReqPhone: 'usereqphone',
    textSupport: 'textsupport',
    fullName: 'fullname',
    trunkName: 'trunkname',
    cidNumber: 'cid_number',
    callingPres: 'callingpres',
    mohInterpret: 'mohinterpret',
    mohSuggest: 'mohsuggest',
    parkingLot: 'parkinglot',
    subscribeContext: 'subscribecontext',
    autoFraming: 'autoframing',
    rtpKeepalive: 'rtpkeepalive',
}

export const pjsipFieldMap: Record<string, string> = {
    directMedia: 'direct_media',
    dtmfMode: 'dtmf_mode',
    forceRport: 'force_rport',
    iceSupport: 'ice_support',
    rewriteContact: 'rewrite_contact',
    rtpSymmetric: 'rtp_symmetric',
    sendDiversion: 'send_diversion',
    timersMinSe: 'timers_min_se',
    timersSessExpires: 'timers_sess_expires',
    oneTouchRecording: 'one_touch_recording',
    allowTransfer: 'allow_transfer',
    allowSubscribe: 'allow_subscribe',
    fromUser: 'from_user',
    fromDomain: 'from_domain',
    outboundProxy: 'outbound_proxy',
    mohSuggest: 'moh_suggest',
    aorMaxContacts: 'aor_max_contacts',
    aorQualifyFrequency: 'aor_qualify_frequency',
    aorQualifyTimeout: 'aor_qualify_timeout',
    aorMinimumExpiration: 'aor_minimum_expiration',
    aorMaximumExpiration: 'aor_maximum_expiration',
    aorDefaultExpiration: 'aor_default_expiration',
    aorRemoveExisting: 'aor_remove_existing',
    aorAuthenticateQualify: 'aor_authenticate_qualify',
    aorSupportPath: 'aor_support_path',
    aorOutboundProxy: 'aor_outbound_proxy',
    namedCallGroup: 'namedcallgroup',
    namedPickupGroup: 'namedpickupgroup',
}

export const sipFieldKeys = Object.keys(sipFields)
export const pjsipFieldKeys = Object.keys(pjsipFields)
// Usado só na direção de leitura (GET) — exclui md5Secret/remoteSecret, ver sipFieldsPublic acima
export const sipReadableFieldKeys = Object.keys(sipFieldsPublic)

export const BATCH_LIMIT = 50

export const createExtensionBatchSchema = z
    .object({
        extensions: z.array(createExtensionSchema).min(1).max(BATCH_LIMIT),
    })
    .superRefine((val, ctx) => {
        const seen = new Set<string>()
        val.extensions.forEach((e, i) => {
            const key = `${e.alias}:${e.companyId}`
            if (seen.has(key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Duplicate alias "${e.alias}" for same company at index ${i}`,
                    path: ['extensions', i, 'alias'],
                })
            }
            seen.add(key)
        })
    })

export type ExtensionIdParam = z.infer<typeof extensionIdParamSchema>
export type ExtensionQuery = z.infer<typeof extensionQuerySchema>
export type CreateExtensionInput = z.infer<typeof createExtensionSchema>
export type CreateExtensionBatchInput = z.infer<typeof createExtensionBatchSchema>
export type UpdateExtensionInput = z.infer<typeof updateExtensionSchema>

// GET expõe todos os campos crus do sip_peers/ps_endpoints+ps_aors (menos senha — secret nunca entra em
// sipFields, md5Secret/remoteSecret são excluídos via sipFieldsPublic, e o password do pjsip vive só em
// ps_auths, nunca consultado pra esse merge)
export const ExtensionSchema = z.object({
    id: z.string(),
    alias: z.string(),
    username: z.string(),
    name: z.string(),
    type: z.enum(['sip', 'pjsip']),
    companyId: z.string(),
    context: z.string(),
    allowOutbound: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...sipFieldsPublic,
    ...pjsipFields,
    // sipFields/pjsipFields divergem de tipo nessas duas chaves — mesmo tratamento do updateExtensionSchema
    directMedia: z.union([z.string().max(10), z.boolean()]).optional(),
    allowSubscribe: z.union([z.string().max(10), z.boolean()]).optional(),
})

const ExtensionWithPasswordSchema = ExtensionSchema.extend({ password: z.string() })

export const BatchResultSchema = z.object({
    success: z.boolean(),
    created: z.array(ExtensionWithPasswordSchema),
    errors: z.array(z.object({ alias: z.string(), error: z.string() })),
})

export const ListExtensionsResponse = ok({
    message: z.string(),
    extensions: z.object({ sip: z.array(ExtensionSchema), pjsip: z.array(ExtensionSchema) }),
})
export const GetExtensionResponse = ok({ message: z.string(), extension: ExtensionSchema })
export const CreateExtensionResponse = ok({ message: z.string(), extension: ExtensionWithPasswordSchema })
export const UpdateExtensionResponse = ok({ message: z.string(), extension: ExtensionSchema })
export const ResetPasswordResponse = ok({ message: z.string(), password: z.string() })

export const ExportExtensionSchema = z.object({
    id: z.string(),
    alias: z.string(),
    username: z.string(),
    name: z.string(),
    type: z.enum(['sip', 'pjsip']),
    companyId: z.string(),
    password: z.string(),
})
export const ExportExtensionsResponse = ok({
    message: z.string(),
    extensions: z.array(ExportExtensionSchema),
})
