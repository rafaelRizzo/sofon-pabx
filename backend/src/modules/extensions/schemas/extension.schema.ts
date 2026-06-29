import { z } from 'zod'

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
    dtmfmode: z.string().max(10).optional(),
    directmedia: z.string().max(10).optional(),
    language: z.string().max(40).optional(),
    qualify: z.string().max(10).optional(),
    disallow: z.string().max(200).optional(),
    allow: z.string().max(200).optional(),
    insecure: z.string().max(40).optional(),
    transport: z.string().max(10).optional(),
    callerid: z.string().max(40).optional(),
    defaultuser: z.string().max(40).optional(),
    permit: z.string().max(95).optional(),
    deny: z.string().max(95).optional(),
    md5secret: z.string().max(40).optional(),
    remotesecret: z.string().max(40).optional(),
    callgroup: z.string().max(40).optional(),
    pickupgroup: z.string().max(40).optional(),
    mailbox: z.string().max(40).optional(),
    accountcode: z.string().max(40).optional(),
    fromuser: z.string().max(40).optional(),
    fromdomain: z.string().max(40).optional(),
    trustrpid: z.string().max(10).optional(),
    progressinband: z.string().max(10).optional(),
    promiscredir: z.string().max(10).optional(),
    useclientcode: z.string().max(10).optional(),
    setvar: z.string().max(200).optional(),
    amaflags: z.string().max(40).optional(),
    callcounter: z.string().max(10).optional(),
    busylevel: z.number().int().optional(),
    allowoverlap: z.string().max(10).optional(),
    allowsubscribe: z.string().max(10).optional(),
    videosupport: z.string().max(10).optional(),
    maxcallbitrate: z.number().int().optional(),
    rfc2833compensate: z.string().max(10).optional(),
    sessionTimers: z.string().max(10).optional(),
    sessionExpires: z.number().int().optional(),
    sessionMinse: z.number().int().optional(),
    sessionRefresher: z.string().max(10).optional(),
    t38ptUsertpsource: z.string().max(10).optional(),
    regexten: z.string().max(40).optional(),
    defaultip: z.string().max(45).optional(),
    rtptimeout: z.number().int().optional(),
    rtpholdtimeout: z.number().int().optional(),
    sendrpid: z.string().max(10).optional(),
    outboundproxy: z.string().max(40).optional(),
    callbackextension: z.string().max(40).optional(),
    timert1: z.number().int().optional(),
    timerb: z.number().int().optional(),
    qualifyfreq: z.number().int().optional(),
    constantssrc: z.string().max(10).optional(),
    contactpermit: z.string().max(95).optional(),
    contactdeny: z.string().max(95).optional(),
    usereqphone: z.string().max(10).optional(),
    textsupport: z.string().max(10).optional(),
    faxdetect: z.string().max(10).optional(),
    buggymwi: z.string().max(10).optional(),
    auth: z.string().max(40).optional(),
    fullname: z.string().max(40).optional(),
    trunkname: z.string().max(40).optional(),
    cidNumber: z.string().max(40).optional(),
    callingpres: z.string().max(20).optional(),
    mohinterpret: z.string().max(40).optional(),
    mohsuggest: z.string().max(40).optional(),
    parkinglot: z.string().max(40).optional(),
    hasvoicemail: z.string().max(10).optional(),
    subscribecontext: z.string().max(80).optional(),
    subscribemwi: z.string().max(10).optional(),
    vmexten: z.string().max(40).optional(),
    autoframing: z.string().max(10).optional(),
    rtpkeepalive: z.number().int().optional(),
}

// ─── PJSIP-only fields (ps_endpoints + ps_aors via aor_ prefix) ──────────────
const pjsipFields = {
    transport: z.string().max(40).optional(),
    disallow: z.string().max(200).optional(),
    allow: z.string().max(200).optional(),
    direct_media: z.boolean().optional(),
    dtmf_mode: z.string().max(40).optional(),
    force_rport: z.boolean().optional(),
    ice_support: z.boolean().optional(),
    rewrite_contact: z.boolean().optional(),
    rtp_symmetric: z.boolean().optional(),
    send_diversion: z.boolean().optional(),
    timers: z.string().max(40).optional(),
    timers_min_se: z.number().int().optional(),
    timers_sess_expires: z.number().int().optional(),
    language: z.string().max(10).optional(),
    one_touch_recording: z.boolean().optional(),
    allow_transfer: z.boolean().optional(),
    allow_subscribe: z.boolean().optional(),
    from_user: z.string().max(40).nullish(),
    from_domain: z.string().max(40).nullish(),
    outbound_proxy: z.string().max(40).nullish(),
    mailboxes: z.string().max(40).nullish(),
    moh_suggest: z.string().max(40).optional(),
    rel: z.string().max(40).optional(),
    // ps_aors (aor_ prefix)
    aor_max_contacts: z.number().int().optional(),
    aor_qualify_frequency: z.number().int().optional(),
    aor_qualify_timeout: z.number().optional(),
    aor_minimum_expiration: z.number().int().optional(),
    aor_maximum_expiration: z.number().int().optional(),
    aor_default_expiration: z.number().int().optional(),
    aor_remove_existing: z.boolean().optional(),
    aor_authenticate_qualify: z.boolean().optional(),
    aor_support_path: z.boolean().optional(),
    aor_outbound_proxy: z.string().max(40).nullish(),
    aor_mailboxes: z.string().max(80).nullish(),
    // user informs logical name(s), e.g. "suporte" or "suporte,financeiro"
    // service prefixes with asteriskId before writing to ps_endpoints
    namedcallgroup: z.string().max(80).optional(),
    namedpickupgroup: z.string().max(80).optional(),
}

const baseShape = {
    alias: aliasSchema,
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    context: z.string().max(40).default('ramais'),
}

export const createExtensionSchema = z.discriminatedUnion('type', [
    z.object({ ...baseShape, type: z.literal('sip'), ...sipFields }).strict(),
    z.object({ ...baseShape, type: z.literal('pjsip'), ...pjsipFields }).strict(),
])

export const updateExtensionSchema = z
    .object({
        name: z.string().min(1).max(80).optional(),
        alias: aliasSchema.optional(),
        context: z.string().max(40).optional(),
        ...sipFields,
        ...pjsipFields,
        // shared fields: use most permissive constraint
        language: z.string().max(40).optional(),
        transport: z.string().max(40).optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field is required',
    })

export const sipFieldKeys = Object.keys(sipFields)
export const pjsipFieldKeys = Object.keys(pjsipFields)

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
