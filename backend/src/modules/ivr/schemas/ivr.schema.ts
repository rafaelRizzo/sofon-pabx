import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const destinationSchema = routeDestinationSchema
export type IvrDest = z.infer<typeof destinationSchema>

const digitSchema = z.string().regex(/^[0-9]$/, 'digit must be a single character 0-9')

const ivrOptionsSchema = z.array(z.object({
    digit:       digitSchema,
    destination: destinationSchema.optional(),
})).max(10).refine(
    (opts) => new Set(opts.map((o) => o.digit)).size === opts.length,
    { message: 'Duplicate digit in options' },
)

export const IVR_MENU_TYPES = ['menu', 'collect'] as const
export type IvrMenuType = (typeof IVR_MENU_TYPES)[number]

// variáveis internas da state machine (ver ivr.repository.ts): não pode reaproveitar o nome
// como variableName, senão o Set() do modo "collect" corrompe o próprio controle de retries
const RESERVED_IVR_VARIABLES = ['IVR_DIGITS', '__IVR_INV', '__IVR_TMO']

const variableNameSchema = z.string().min(1).max(80)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Nome de variável inválido, use letras, números e _, começando com letra ou _')
    .refine((v) => !RESERVED_IVR_VARIABLES.includes(v), { message: 'Nome de variável reservado pelo sistema' })

export const createIvrMenuSchema = z.object({
    name:               z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle'),
    companyId:          z.cuid2(),
    type:               z.enum(IVR_MENU_TYPES).default('menu'),
    // só usado quando type="collect": expõe os dígitos coletados nessa variável de canal
    variableName:       variableNameSchema.optional(),
    audioId:            z.cuid2().optional().describe('id de um Audio (POST /audios) já enviado — sem ele o menu fica sem dialplan até vincular um depois'),
    maxDigits:          z.number().int().min(1).max(20).default(1),
    digitTimeout:       z.number().int().min(1).max(60).default(5),
    invalidRetries:     z.number().int().min(0).max(10).default(3),
    invalidDestination: destinationSchema.optional(),
    timeoutRetries:     z.number().int().min(0).max(10).default(3),
    timeoutDestination: destinationSchema.optional(),
    longDestination:    destinationSchema.optional(),
    options:            ivrOptionsSchema.default([]),
}).superRefine((data, ctx) => {
    if (data.type === 'collect') {
        if (!data.variableName) ctx.addIssue({ code: 'custom', path: ['variableName'], message: 'variableName is required when type is collect' })
        if (data.options.length > 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'collect type cannot have digit options' })
        if (data.maxDigits < 2) ctx.addIssue({ code: 'custom', path: ['maxDigits'], message: 'collect type requires maxDigits >= 2' })
    } else if (data.variableName) {
        ctx.addIssue({ code: 'custom', path: ['variableName'], message: 'variableName only applies to collect type' })
    }
})

export const updateIvrMenuSchema = z.object({
    name:               z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle').optional(),
    type:               z.enum(IVR_MENU_TYPES).optional(),
    variableName:       variableNameSchema.nullable().optional(),
    audioId:            z.cuid2().nullable().optional(),
    maxDigits:          z.number().int().min(1).max(20).optional(),
    digitTimeout:       z.number().int().min(1).max(60).optional(),
    invalidRetries:     z.number().int().min(0).max(10).optional(),
    invalidDestination: destinationSchema.optional(),
    timeoutRetries:     z.number().int().min(0).max(10).optional(),
    timeoutDestination: destinationSchema.optional(),
    longDestination:    destinationSchema.optional(),
    options:            ivrOptionsSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateIvrMenuInput = z.infer<typeof createIvrMenuSchema>
export type UpdateIvrMenuInput = z.infer<typeof updateIvrMenuSchema>

const IvrOptionSchema = z.object({
    id:          z.string(),
    digit:       z.string(),
    destination: routeDestinationResponseSchema,
})

export const IvrMenuSchema = z.object({
    id:                 z.string(),
    name:               z.string(),
    companyId:          z.string(),
    type:               z.enum(IVR_MENU_TYPES),
    variableName:       z.string().nullable(),
    audioId:            z.string().nullable(),
    hasAudio:           z.boolean().describe('true quando há um Audio vinculado — usar como destino de rota exige áudio'),
    maxDigits:          z.number().describe('máximo de dígitos aceitos pelo Read() — >1 permite sequência longa (ex: CPF) via longDestination'),
    digitTimeout:       z.number().describe('segundos que o Asterisk aguarda por dígito antes de considerar timeout'),
    invalidRetries:     z.number().describe('tentativas com dígito inválido antes de ir pro invalidDestination'),
    invalidDestination: routeDestinationResponseSchema,
    timeoutRetries:     z.number().describe('tentativas sem entrada antes de ir pro timeoutDestination'),
    timeoutDestination: routeDestinationResponseSchema,
    longDestination:    routeDestinationResponseSchema.describe('destino quando o chamador digita mais de 1 dígito (até maxDigits) sem bater com nenhuma opção — ex: CPF'),
    options:            z.array(IvrOptionSchema),
    createdAt:          timestamp,
    updatedAt:          timestamp,
})

export const ListIvrMenusResponse = ok({ message: z.string(), ivrMenus: z.array(IvrMenuSchema) })
export const GetIvrMenuResponse = ok({ message: z.string(), ivrMenu: IvrMenuSchema })
export const CreateIvrMenuResponse = ok({ message: z.string(), ivrMenuId: z.string() })
export const UpdateIvrMenuResponse = ok({ message: z.string() })
