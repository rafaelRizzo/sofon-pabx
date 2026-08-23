import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'
import { isSafeDialplanValue } from '../../../schemas/dialplan-safety'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export { isSafeDialplanValue }

const assignmentSchema = z.object({
    variable: z.string().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, digits and underscore, starting with a letter or underscore'),
    value: z.string().max(500).refine(isSafeDialplanValue, {
        message: 'Use only literal text or approved interpolations such as ${CALLERID(num)} and ${VARIABLE_NAME}',
    }),
})

export const createVariableSetSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    assignments: z.array(assignmentSchema).min(1).max(20),
    destination: routeDestinationSchema.optional(),
})

export const updateVariableSetSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    assignments: z.array(assignmentSchema).min(1).max(20).optional(),
    destination: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, assignments, destination' })

export type CreateVariableSetInput = z.infer<typeof createVariableSetSchema>
export type UpdateVariableSetInput = z.infer<typeof updateVariableSetSchema>
export type Assignment = z.infer<typeof assignmentSchema>

const AssignmentResponseSchema = z.object({
    variable: z.string(),
    value: z.string(),
})

export const VariableSetSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    assignments: z.array(AssignmentResponseSchema),
    destination: routeDestinationResponseSchema,
    usedBy: usedBySchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListVariableSetsResponse = ok({ message: z.string(), variableSets: z.array(VariableSetSchema) })
export const GetVariableSetResponse = ok({ message: z.string(), variableSet: VariableSetSchema })
export const CreateVariableSetResponse = ok({ message: z.string(), variableSetId: z.string() })
export const UpdateVariableSetResponse = ok({ message: z.string() })
