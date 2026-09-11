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
    // null/omitido = recorrente todo ano (feriado fixo); preenchido = válido só nesse ano (feriado
    // móvel vindo da API, ex: Carnaval, que muda de data ano a ano)
    year:  z.number().int().min(1900).max(2100).nullish(),
})

// Contrato é URL BASE - o sistema já adiciona "/<ano>" na chamada (ver http.provider.ts). URL
// terminando em 4 dígitos é o erro mais comum (usuário copia o endereço já testado com o ano, ex:
// .../v1/2026, no navegador) e gera uma chamada errada em duplicidade (.../v1/2026/2026 => 404).
const urlEndsWithYear = /\/\d{4}\/?$/
const urlWithoutYear = (d: { url?: string | null }) => !d.url || !urlEndsWithYear.test(d.url)
const urlWithoutYearMessage = {
    message: 'URL não deve terminar com o ano - o sistema já adiciona "/<ano>" automaticamente na chamada (ex: https://brasilapi.com.br/api/feriados/v1, sem "/2026" no final)',
    path: ['url'],
}

export const createHolidayGroupSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle'),
    companyId:  z.cuid2(),
    url:        z.union([z.string().min(1).max(500), z.null()]).optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    dates:      z.array(holidayDateSchema).max(50).optional(),
    notes:      z.string().max(10000).optional(),
}).refine((d) => !(d.url && d.dates), {
    message: 'Cannot set dates manually when url is configured - dates are managed automatically by the resync job',
    path: ['dates'],
}).refine(urlWithoutYear, urlWithoutYearMessage)

export const updateHolidayGroupSchema = z.object({
    name:       z.string().min(1).max(80).regex(/^[^\x00-\x1f\x7f]*$/, 'Nome não pode conter caracteres de controle').optional(),
    url:        z.union([z.string().min(1).max(500), z.null()]).optional(),
    trueRoute:  routeDestSchema.optional(),
    falseRoute: routeDestSchema.optional(),
    dates:      z.array(holidayDateSchema).max(50).optional(),
    notes:      z.string().max(10000).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, url, trueRoute, falseRoute, dates' })
  .refine((d) => !(d.url && d.dates), {
      message: 'Cannot set dates manually when url is configured - dates are managed automatically by the resync job',
      path: ['dates'],
  })
  .refine(urlWithoutYear, urlWithoutYearMessage)

export type CreateHolidayGroupInput = z.infer<typeof createHolidayGroupSchema>
export type UpdateHolidayGroupInput = z.infer<typeof updateHolidayGroupSchema>

const HolidayDateResponseSchema = z.object({
    id:    z.string(),
    name:  z.string(),
    month: z.number(),
    day:   z.number(),
    year:  z.number().nullable(),
})

export const HolidayGroupSchema = z.object({
    id:         z.string(),
    name:       z.string(),
    companyId:  z.string(),
    url:        z.string().nullable(),
    trueRoute:  routeDestinationResponseSchema,
    falseRoute: routeDestinationResponseSchema,
    dates:      z.array(HolidayDateResponseSchema),
    notes:      z.string().nullable(),
    usedBy:     usedBySchema,
    createdAt:  timestamp,
    updatedAt:  timestamp,
})

export const ListHolidayGroupsResponse = ok({ message: z.string(), holidayGroups: z.array(HolidayGroupSchema) })
export const GetHolidayGroupResponse = ok({ message: z.string(), holidayGroup: HolidayGroupSchema })
export const CreateHolidayGroupResponse = ok({ message: z.string(), holidayGroupId: z.string() })
export const UpdateHolidayGroupResponse = ok({ message: z.string() })
