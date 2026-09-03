import { z } from 'zod'
import { ok } from '../../../schemas/responses'

export const dashboardOverviewQuerySchema = z.object({ companyId: z.cuid2().optional() })

export const DashboardOverviewSchema = z.object({
    extensionsOnline: z.number(),
    extensionsOffline: z.number(),
    callsToday: z.number(),
    callsThisMonth: z.number(),
    callsThisYear: z.number(),
})

export const DashboardOverviewResponse = ok({ overview: DashboardOverviewSchema })

export const DashboardInfraSchema = z.object({
    cpu: z.object({
        loadAvg1: z.number(),
        loadAvg5: z.number(),
        loadAvg15: z.number(),
        cores: z.number(),
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
