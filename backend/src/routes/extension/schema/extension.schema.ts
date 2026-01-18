import { z } from 'zod'

const uuidSchema = z.cuid({ message: 'Formato de id inválido' })

// Schema para validar o config (whitelist de campos permitidos)
const configSchema = z.object({
    secret: z.string().max(500).optional(),
    context: z.string().max(500).optional(),
    host: z.string().max(500).optional(),
    type: z.string().max(500).optional(),
    qualify: z.union([z.string(), z.number(), z.boolean()]).optional(),
    nat: z.string().max(500).optional(),
    canreinvite: z.union([z.string(), z.boolean()]).optional(),
    insecure: z.string().max(500).optional(),
    port: z.union([z.string(), z.number()]).optional(),
    dtmfmode: z.string().max(500).optional(),
    codec: z.string().max(500).optional(),
    allow: z.string().max(500).optional(),
    disallow: z.string().max(500).optional(),
    directmedia: z.union([z.string(), z.boolean()]).optional(),
    transport: z.string().max(500).optional(),
    encryption: z.string().max(500).optional(),
    avpf: z.union([z.string(), z.boolean()]).optional(),
    icesupport: z.union([z.string(), z.boolean()]).optional(),
    callerid: z.string().max(500).optional(),
    accountcode: z.string().max(500).optional(),
    amaflags: z.string().max(500).optional(),
    callgroup: z.union([z.string(), z.number()]).optional(),
    pickupgroup: z.union([z.string(), z.number()]).optional(),
    mailbox: z.string().max(500).optional(),
    deny: z.string().max(500).optional(),
    permit: z.string().max(500).optional(),
    md5secret: z.string().max(500).optional(),
    sendrpid: z.union([z.string(), z.boolean()]).optional(),
    trustrpid: z.union([z.string(), z.boolean()]).optional(),
    progressinband: z.string().max(500).optional(),
    promiscredir: z.union([z.string(), z.boolean()]).optional(),
    useclientcode: z.union([z.string(), z.boolean()]).optional()
}).strict()

export const createExtensionSchema = {
    body: z.object({
        name: z.string().min(1, 'Nome é obrigatório').max(255),
        alias: z.string().min(1, 'Alias é obrigatório').max(50),
        companyId: uuidSchema,
        callerIdName: z.string().min(1, 'Caller ID Name é obrigatório').max(255),
        callerIdNum: z.string().min(1, 'Número do ramal é obrigatório').max(50),
        typeExtension: z.enum(['SIP', 'PJSIP', 'IAX'], {
            message: 'Tipo de extensão inválido. Use: SIP, PJSIP ou IAX'
        }),
        config: configSchema,
        description: z.string().max(500).optional()
    })
}

export const updateExtensionSchema = {
    params: z.object({
        id: uuidSchema
    }),
    body: z.object({
        name: z.string().min(1).max(255).optional(),
        alias: z.string().min(1).max(50).optional(),
        callerIdName: z.string().min(1).max(255).optional(),
        callerIdNum: z.string().min(1).max(50).optional(),
        typeExtension: z.enum(['SIP', 'PJSIP', 'IAX'], {
            message: 'Tipo de extensão inválido. Use: SIP, PJSIP ou IAX'
        }).optional(),
        config: configSchema.optional(),
        description: z.string().max(500).optional()
    })
}

export const getExtensionSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export const listExtensionSchema = {
    query: z.object({
        companyId: uuidSchema.optional()
    })
}

export const deleteExtensionSchema = {
    params: z.object({
        id: uuidSchema
    })
}

export type CreateExtensionInput = z.infer<typeof createExtensionSchema.body>
export type UpdateExtensionInput = z.infer<typeof updateExtensionSchema.body>
export type GetExtensionParams = z.infer<typeof getExtensionSchema.params>
export type ListExtensionQuery = z.infer<typeof listExtensionSchema.query>
export type DeleteExtensionParams = z.infer<typeof deleteExtensionSchema.params>