import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'
import { usedBySchema } from '../../../schemas/flow-reference-label'

export const routeDestSchema = routeDestinationSchema

export type RouteDest = z.infer<typeof routeDestSchema>

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

const holidayDateSchema = z.object({
    name:  z.string().min(1).max(80),
    month: z.number().int().min(1).max(12),
    day:   z.number().int().min(1).max(31),
})

export const createHolidayGroupSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle'),
    companyId:  z.cuid2(),
    url:        z.union([z.string().min(1).max(500), z.null()]).optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    dates:      z.array(holidayDateSchema).max(50).optional(),
}).refine((d) => !(d.url && d.dates), {
    message: 'Cannot set dates manually when url is configured — dates are managed automatically by the resync job',
    path: ['dates'],
})

export const updateHolidayGroupSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle').optional(),
    url:        z.union([z.string().min(1).max(500), z.null()]).optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    dates:      z.array(holidayDateSchema).max(50).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, url, trueRoute, falseRoute, dates' })
  .refine((d) => !(d.url && d.dates), {
      message: 'Cannot set dates manually when url is configured — dates are managed automatically by the resync job',
      path: ['dates'],
  })

export type CreateHolidayGroupInput = z.infer<typeof createHolidayGroupSchema>
export type UpdateHolidayGroupInput = z.infer<typeof updateHolidayGroupSchema>

const HolidayDateResponseSchema = z.object({
    id:    z.string(),
    name:  z.string(),
    month: z.number(),
    day:   z.number(),
})

export const HolidayGroupSchema = z.object({
    id:         z.string(),
    name:       z.string(),
    companyId:  z.string(),
    url:        z.string().nullable(),
    trueRoute:  routeDestinationResponseSchema,
    falseRoute: routeDestinationResponseSchema,
    dates:      z.array(HolidayDateResponseSchema),
    usedBy:     usedBySchema,
    createdAt:  timestamp,
    updatedAt:  timestamp,
})

export const ListHolidayGroupsResponse = ok({ message: z.string(), holidayGroups: z.array(HolidayGroupSchema) })
export const GetHolidayGroupResponse = ok({ message: z.string(), holidayGroup: HolidayGroupSchema })
export const CreateHolidayGroupResponse = ok({ message: z.string(), holidayGroupId: z.string() })
export const UpdateHolidayGroupResponse = ok({ message: z.string() })
