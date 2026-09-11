import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const timeRangeSchema = z.object({
    startTime: z.string().regex(timeRegex, 'Invalid time format HH:MM'),
    endTime: z.string().regex(timeRegex, 'Invalid time format HH:MM'),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1),
    monthdays: z.string().regex(/^(\*|([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01]))?)$/).default('*'),
    months: z.string().regex(/^(\*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(-[a-z]{3})?)$/).default('*'),
})

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const createTimeGroupSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    ranges: z.array(timeRangeSchema).min(1).max(20),
    notes: z.string().max(10000).optional(),
})

export const updateTimeGroupSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    ranges: z.array(timeRangeSchema).min(1).max(20).optional(),
    notes: z.string().max(10000).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, ranges' })

export type CreateTimeGroupInput = z.infer<typeof createTimeGroupSchema>
export type UpdateTimeGroupInput = z.infer<typeof updateTimeGroupSchema>

const TimeRangeSchema = z.object({
    id: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    weekdays: z.array(z.string()),
    monthdays: z.string(),
    months: z.string(),
    createdAt: timestamp,
})

export const TimeGroupSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    ranges: z.array(TimeRangeSchema),
    notes: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListTimeGroupsResponse = ok({ message: z.string(), timeGroups: z.array(TimeGroupSchema) })
export const GetTimeGroupResponse = ok({ message: z.string(), timeGroup: TimeGroupSchema })
export const CreateTimeGroupResponse = ok({ message: z.string(), timeGroupId: z.string() })
export const UpdateTimeGroupResponse = ok({ message: z.string() })
