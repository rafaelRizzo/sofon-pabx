import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { getExtension: mock(() => null), setExtension: mock() },
}))

import * as RatingsService from '../ratings.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const EXT = { id: 'e1', alias: '2001', name: 'Agent', type: 'pjsip', context: 'ramais', allowOutbound: true, companyId: 'c1', createdAt: new Date(), updatedAt: new Date() }
const RATING = { id: 'rt1', companyId: 'c1', extensionId: 'e1', number: '11999998888', uniqueid: '1234.5', scoreAtendimento: 5, scoreServico: null, createdAt: new Date() }

const BASE_QUERY = { companyId: 'c1', limit: 50, order: 'desc' } as any

beforeEach(() => clearPrismaMock(db))

describe('RatingsService.getRatingsByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(RatingsService.getRatingsByCompany({ ...BASE_QUERY, companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns records with total/limit', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callRating.findMany.mockResolvedValue([RATING])
        db.callRating.count.mockResolvedValue(1)

        const result = await RatingsService.getRatingsByCompany(BASE_QUERY) as any

        expect(db.callRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ companyId: 'c1' }),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }))
        expect(result.records[0].id).toBe('rt1')
        expect(result.total).toBe(1)
        expect(result.limit).toBe(50)
    })

    it('applies extensionId/number/date filters and honors order=asc', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callRating.findMany.mockResolvedValue([])
        db.callRating.count.mockResolvedValue(0)

        await RatingsService.getRatingsByCompany({
            ...BASE_QUERY,
            extensionId: 'e1', number: '11999998888', order: 'asc',
            startDate: '2026-01-01', endDate: '2026-01-31',
        })

        expect(db.callRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                companyId: 'c1',
                extensionId: 'e1',
                number: { contains: '11999998888' },
                createdAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T23:59:59.999Z') },
            }),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }))
    })

    it('applies score filter (bate em scoreAtendimento OU scoreServico)', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callRating.findMany.mockResolvedValue([])
        db.callRating.count.mockResolvedValue(0)

        await RatingsService.getRatingsByCompany({ ...BASE_QUERY, score: 5 })

        expect(db.callRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                companyId: 'c1',
                OR: [{ scoreAtendimento: 5 }, { scoreServico: 5 }],
            }),
        }))
    })
})

describe('RatingsService.createRating', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(RatingsService.createRating({
            companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', extensionId: 'e1', number: '11999998888', score: 5, category: 'atendimento',
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(RatingsService.createRating({
            companyId: 'c1', extensionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', number: '11999998888', score: 5, category: 'atendimento',
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('creates rating without uniqueid (no merge possible)', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.callRating.create.mockResolvedValue(RATING)
        const rating = await RatingsService.createRating({
            companyId: 'c1', extensionId: 'e1', number: '11999998888', score: 5, category: 'atendimento',
        }) as any
        expect(rating.id).toBe('rt1')
        expect(db.callRating.create).toHaveBeenCalledWith({
            data: { companyId: 'c1', extensionId: 'e1', number: '11999998888', uniqueid: undefined, scoreAtendimento: 5 },
        })
        expect(db.callRating.upsert).not.toHaveBeenCalled()
    })

    it('upserts by companyId+uniqueid so the 2 survey questions land on the same row', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.callRating.upsert.mockResolvedValue(RATING)

        await RatingsService.createRating({
            companyId: 'c1', extensionId: 'e1', number: '11999998888', uniqueid: '1234.5', score: 4, category: 'servico',
        })

        expect(db.callRating.upsert).toHaveBeenCalledWith({
            where: { companyId_uniqueid: { companyId: 'c1', uniqueid: '1234.5' } },
            update: { extensionId: 'e1', number: '11999998888', scoreServico: 4 },
            create: { companyId: 'c1', extensionId: 'e1', number: '11999998888', uniqueid: '1234.5', scoreServico: 4 },
        })
    })
})
