import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const dashboardOverviewQuerySchema = z.object({ companyId: z.cuid2().optional() })

export const dashboardCallsByRegionQuerySchema = z.object({
    companyId: z.cuid2().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    direction: z.enum(['all', 'inbound', 'outbound']).default('all'),
})

export type DashboardCallsByRegionQueryInput = z.infer<typeof dashboardCallsByRegionQuerySchema>

export const DashboardOverviewSchema = z.object({
    extensionsOnline: z.number(),
    extensionsOffline: z.number(),
    callsToday: z.number(),
    callsYesterday: z.number(),
    callsThisMonth: z.number(),
    callsThisYear: z.number(),
    callsOutboundToday: z.number(),
})

export const DashboardOverviewResponse = ok({ overview: DashboardOverviewSchema })

export const DashboardCallsByRegionSchema = z.object({
    regions: z.array(
        z.object({
            uf: z.string(),
            calls: z.number(),
            byDdd: z.array(z.object({ ddd: z.string(), calls: z.number() })),
        })
    ),
})

export const DashboardCallsByRegionResponse = ok({ callsByRegion: DashboardCallsByRegionSchema })

export const DashboardInfraSchema = z.object({
    uptimeSeconds: z.number(),
    network: z.object({
        rxBytesPerSec: z.number(),
        txBytesPerSec: z.number(),
    }),
    cpu: z.object({
        loadAvg1: z.number(),
        loadAvg5: z.number(),
        loadAvg15: z.number(),
        cores: z.number(),
        perCoreUsedPct: z.array(z.number()),
    }),
    memory: z.object({
        totalBytes: z.number(),
        freeBytes: z.number(),
        usedPct: z.number(),
    }),
    disk: z.object({
        totalBytes: z.number(),
        usedBytes: z.number(),
        freeBytes: z.number(),
        usedPct: z.number(),
    }),
    recordings: z.object({ sizeBytes: z.number() }),
    logs: z.object({ sizeBytes: z.number() }),
})

export const DashboardInfraResponse = ok({ infra: DashboardInfraSchema })
