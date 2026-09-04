import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))

import * as DashboardService from '../dashboard.service'

// Não mockar realtime.service (compartilhado, tem teste próprio - mock.module() vaza entre
// arquivos no bun, mesmo cuidado documentado pra FlowEdgeRepository). getExtensionsStatus real
// roda aqui de verdade, mas como db.extension.findMany já tem default [] (ver prisma.mock.ts),
// nunca chega a tocar Redis - só interessa testar a contagem de chamadas/período aqui.
beforeEach(() => clearPrismaMock(db))

// parseDfOutput é a única parte de dashboard.service.ts que não depende de Bun.spawn de verdade -
// mesma limitação de handleRequestTemplate/handlers AGI já documentada no CLAUDE.md (protocolo/
// processo externo cru, sem mock estabelecido no projeto pra isso ainda)
describe('DashboardService.parseDfOutput', () => {
    it('parses a real df -B1 output line', () => {
        const output = 'Filesystem     1B-blocks       Used   Available Use% Mounted on\n' +
            '/dev/sda1   107321753600 42928701440 64393052160  40% /\n'
        const result = DashboardService.parseDfOutput(output)
        expect(result).toEqual({
            totalBytes: 107321753600,
            usedBytes: 42928701440,
            freeBytes: 64393052160,
            usedPct: 42928701440 / 107321753600,
        })
    })

    it('throws when the output cannot be parsed', () => {
        expect(() => DashboardService.parseDfOutput('garbage output')).toThrow()
    })
})

describe('DashboardService.getDashboardOverview', () => {
    it('returns all zeros when companyIds is an empty array (no access)', async () => {
        const result = await DashboardService.getDashboardOverview([])
        expect(result).toEqual({
            extensionsOnline: 0, extensionsOffline: 0,
            callsToday: 0, callsYesterday: 0, callsThisMonth: 0, callsThisYear: 0,
            callsOutboundToday: 0,
        })
        expect(db.company.findMany).not.toHaveBeenCalled()
    })

    it('counts calls per period scoped by accountcode', async () => {
        db.company.findMany.mockResolvedValue([{ asteriskId: 'ast1' }, { asteriskId: 'ast2' }])
        db.cdr.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(40).mockResolvedValueOnce(300).mockResolvedValueOnce(1)

        const result = await DashboardService.getDashboardOverview(['c1', 'c2'])

        expect(result.extensionsOnline).toBe(0)
        expect(result.extensionsOffline).toBe(0)
        expect(result.callsToday).toBe(5)
        expect(result.callsYesterday).toBe(2)
        expect(result.callsThisMonth).toBe(40)
        expect(result.callsThisYear).toBe(300)
        expect(result.callsOutboundToday).toBe(1)
        expect(db.cdr.count).toHaveBeenCalledTimes(5)
        for (const call of db.cdr.count.mock.calls) {
            expect(call[0].where.accountcode).toEqual({ in: ['ast1', 'ast2'] })
        }
    })
})

describe('DashboardService.getDashboardCallsByRegion', () => {
    it('returns no regions when companyIds is an empty array (no access)', async () => {
        const result = await DashboardService.getDashboardCallsByRegion([], { direction: 'all' })
        expect(result).toEqual({ regions: [] })
        expect(db.company.findMany).not.toHaveBeenCalled()
    })

    it('aggregates calls by UF with a DDD breakdown, picking src/dst per direction', async () => {
        db.company.findMany.mockResolvedValue([{ asteriskId: 'ast1' }])
        db.cdr.findMany.mockResolvedValue([
            { direction: 'inbound', src: '11987654321', dst: '2002' },
            { direction: 'inbound', src: '11912345678', dst: '2002' },
            { direction: 'outbound', src: '2002', dst: '21934567890' },
            { direction: 'inbound', src: '2002', dst: '2003' }, // ramal->ramal, sem DDD válido
        ])

        const result = await DashboardService.getDashboardCallsByRegion(['c1'], { direction: 'all' })

        expect(result.regions).toEqual(
            expect.arrayContaining([
                { uf: 'SP', calls: 2, byDdd: [{ ddd: '11', calls: 2 }] },
                { uf: 'RJ', calls: 1, byDdd: [{ ddd: '21', calls: 1 }] },
            ])
        )
        expect(result.regions).toHaveLength(2)
        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    accountcode: { in: ['ast1'] },
                    direction: { in: ['inbound', 'outbound'] },
                }),
            })
        )
    })

    it('filters by a single direction and date range', async () => {
        db.company.findMany.mockResolvedValue([{ asteriskId: 'ast1' }])
        db.cdr.findMany.mockResolvedValue([])

        await DashboardService.getDashboardCallsByRegion(['c1'], {
            direction: 'outbound',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
        })

        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    direction: 'outbound',
                    startTime: {
                        gte: new Date('2026-01-01T00:00:00.000Z'),
                        lte: new Date('2026-01-31T23:59:59.999Z'),
                    },
                }),
            })
        )
    })
})
