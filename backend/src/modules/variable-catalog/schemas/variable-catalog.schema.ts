import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { variableNameSchema } from '../../../schemas/variable-name.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createVariableSchema = z.object({
    name: variableNameSchema,
    companyId: z.cuid2(),
    description: z.string().max(200).optional(),
})

export const updateVariableSchema = z.object({
    name: variableNameSchema.optional(),
    description: z.string().max(200).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, description' })

export type CreateVariableInput = z.infer<typeof createVariableSchema>
export type UpdateVariableInput = z.infer<typeof updateVariableSchema>

export const VariableSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    description: z.string().nullable(),
    usedBy: usedBySchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListVariablesResponse = ok({ message: z.string(), variables: z.array(VariableSchema) })
export const GetVariableResponse = ok({ message: z.string(), variable: VariableSchema })
export const CreateVariableResponse = ok({ message: z.string(), variableId: z.string() })
export const UpdateVariableResponse = ok({ message: z.string() })
