import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })
export const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

// Legenda: '0' = 1 dígito, 'A' = 1 letra, '*' = 1 alfanumérico qualquer, qualquer outro caractere é
// literal (não consome nada do valor de entrada) - ver src/utils/format-mask.ts. Cada máscara precisa
// ter ao menos 1 token consumidor, senão nunca vai bater com nenhum valor de entrada não-vazio.
const maskSchema = z
    .string()
    .min(1)
    .max(60)
    .refine((m) => /[0A*]/.test(m), 'Mask must contain at least one consuming token (0, A or *)')

export const createFormatterNodeSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    // identificador simples ou chamada de função Asterisk (ex: CALLERID(num)) - lido via AGI GET VARIABLE
    inputVariable: z.string().min(1).max(120),
    // precisa ser um identificador simples (recebe AGI SET VARIABLE) - nunca uma função de canal
    outputVariable: z.string().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, digits and underscore, starting with a letter or underscore'),
    masks: z.array(maskSchema).min(1).max(10),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
})

export const updateFormatterNodeSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    inputVariable: z.string().min(1).max(120).optional(),
    outputVariable: z.string().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, digits and underscore, starting with a letter or underscore').optional(),
    masks: z.array(maskSchema).min(1).max(10).optional(),
    onSuccess: routeDestinationSchema.optional(),
    onError: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type CreateFormatterNodeInput = z.infer<typeof createFormatterNodeSchema>
export type UpdateFormatterNodeInput = z.infer<typeof updateFormatterNodeSchema>

export const FormatterNodeSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    inputVariable: z.string(),
    outputVariable: z.string(),
    masks: z.array(z.string()),
    onSuccess: routeDestinationResponseSchema,
    onError: routeDestinationResponseSchema,
    usedBy: usedBySchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListFormatterNodesResponse = ok({ message: z.string(), formatterNodes: z.array(FormatterNodeSchema) })
export const GetFormatterNodeResponse = ok({ message: z.string(), formatterNode: FormatterNodeSchema })
export const CreateFormatterNodeResponse = ok({ message: z.string(), formatterNodeId: z.string() })
export const UpdateFormatterNodeResponse = ok({ message: z.string() })
