import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/trunks.cache', () => ({
    TrunksCache: {
        getAll: mock(() => null), setAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getForScope: mock(() => null), setForScope: mock(),
        getTrunk: mock(() => null), setTrunk: mock(),
        invalidateAllTrunks: mock(), invalidateTrunk: mock(), invalidateByCompany: mock(),
    },
}))
mock.module('../../../asterisk/pjsip.repository', () => ({
    PjsipRepository: {
        createTrunk: mock(() => Promise.resolve()),
        updateTrunk: mock(() => Promise.resolve()),
        deleteTrunk: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/iax.repository', () => ({
    IaxRepository: {
        createTrunk: mock(() => Promise.resolve()),
        updateTrunk: mock(() => Promise.resolve()),
        deleteTrunk: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: { delete: mock(() => Promise.resolve()) },
    TRUNK_ENTRY_CONTEXT: 'from-trunk',
}))
mock.module('../../outbound-routes/outbound-routes.service', () => ({
    resyncAllPatterns: mock(() => Promise.resolve()),
}))
mock.module('../../outbound-routes/cache/outbound-routes.cache', () => ({
    OutboundRoutesCache: { invalidateRoute: mock(), invalidateByCompany: mock() },
}))

import * as TrunksService from '../trunks.service'
import { PjsipRepository } from '../../../asterisk/pjsip.repository'
import { IaxRepository } from '../../../asterisk/iax.repository'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const TRUNK = {
    id: 't1', name: 'tst-trunk', companyId: 'c1', registrationMode: 'outbound',
    host: '1.2.3.4', username: 'ast1-trunk-tst-trunk', context: 'from-trunk', codecs: 'ulaw,alaw',
    metadata: {}, createdAt: new Date(), updatedAt: new Date(),
}
const TRUNK_WITH_COMPANY = { ...TRUNK, company: { asteriskId: 'ast1' } }

beforeEach(() => {
    clearPrismaMock(db)
    ;(PjsipRepository.createTrunk as any).mockClear()
    ;(PjsipRepository.deleteTrunk as any).mockClear()
    ;(IaxRepository.createTrunk as any).mockClear()
    ;(IaxRepository.deleteTrunk as any).mockClear()
})

// ─── getTrunks ────────────────────────────────────────────────────────────────
describe('TrunksService.getTrunks', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TrunksService.getTrunks('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns trunks for company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.trunk.findMany.mockResolvedValue([TRUNK])
        const trunks = await TrunksService.getTrunks('c1') as any[]
        expect(trunks[0].id).toBe('t1')
    })
})

// ─── getTrunkById ─────────────────────────────────────────────────────────────
describe('TrunksService.getTrunkById', () => {
    it('returns trunk', async () => {
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        const trunk = await TrunksService.getTrunkById('t1') as any
        expect(trunk.id).toBe('t1')
    })

    it('throws 404 with non-existent id', async () => {
        db.trunk.findUnique.mockResolvedValue(null)
        await expect(TrunksService.getTrunkById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createTrunk ──────────────────────────────────────────────────────────────
describe('TrunksService.createTrunk', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TrunksService.createTrunk({
            name: 'tst-trunk', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', registrationMode: 'outbound',
            host: '1.2.3.4', username: 'u', password: 'p', codecs: 'ulaw,alaw',
        } as any))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when trunk name already exists for company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        await expect(TrunksService.createTrunk({
            name: 'tst-trunk', companyId: 'c1', registrationMode: 'outbound',
            host: '1.2.3.4', username: 'u', password: 'p', codecs: 'ulaw,alaw',
        } as any))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates trunk', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.trunk.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(TRUNK)
        db.trunk.create.mockResolvedValue(TRUNK)
        db.trunk.update.mockResolvedValue(TRUNK)

        const trunk = await TrunksService.createTrunk({
            name: 'tst-trunk', companyId: 'c1', registrationMode: 'outbound',
            host: '1.2.3.4', username: 'u', password: 'p', codecs: 'ulaw,alaw',
        } as any) as any

        expect(trunk.id).toBe('t1')
    })
})

// ─── updateTrunk ──────────────────────────────────────────────────────────────
describe('TrunksService.updateTrunk', () => {
    it('throws 404 with non-existent id', async () => {
        db.trunk.findUnique.mockResolvedValue(null)
        await expect(TrunksService.updateTrunk('clxxxxxxxxxxxxxxxxxxxxxxxxx', { host: '5.6.7.8' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates trunk', async () => {
        db.trunk.findUnique
            .mockResolvedValueOnce(TRUNK_WITH_COMPANY)
            .mockResolvedValueOnce({ ...TRUNK, host: '5.6.7.8' })
        db.trunk.update.mockResolvedValue({ ...TRUNK, host: '5.6.7.8' })

        const trunk = await TrunksService.updateTrunk('t1', { host: '5.6.7.8' }) as any
        expect(trunk.host).toBe('5.6.7.8')
    })
})

// ─── setTrunkActive ───────────────────────────────────────────────────────────
describe('TrunksService.setTrunkActive', () => {
    it('throws 404 with non-existent id', async () => {
        db.trunk.findUnique.mockResolvedValue(null)
        await expect(TrunksService.setTrunkActive('clxxxxxxxxxxxxxxxxxxxxxxxxx', false))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('is a no-op when already in the requested state', async () => {
        db.trunk.findUnique.mockResolvedValue({ ...TRUNK_WITH_COMPANY, active: true })
        const trunk = await TrunksService.setTrunkActive('t1', true) as any
        expect(trunk.id).toBe('t1')
        expect(db.trunk.update).not.toHaveBeenCalled()
    })

    it('deactivates trunk tearing down the Asterisk endpoint', async () => {
        db.trunk.findUnique
            .mockResolvedValueOnce({ ...TRUNK_WITH_COMPANY, active: true })
            .mockResolvedValueOnce({ ...TRUNK, active: false })
        db.trunk.update.mockResolvedValue({ ...TRUNK, active: false })

        const trunk = await TrunksService.setTrunkActive('t1', false) as any

        expect(PjsipRepository.deleteTrunk).toHaveBeenCalled()
        expect(db.trunk.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { active: false } })
        expect(trunk.active).toBe(false)
    })

    it('reactivates trunk recreating the Asterisk endpoint', async () => {
        db.trunk.findUnique
            .mockResolvedValueOnce({ ...TRUNK_WITH_COMPANY, active: false })
            .mockResolvedValueOnce({ ...TRUNK, active: true })
        db.trunk.update.mockResolvedValue({ ...TRUNK, active: true })

        await TrunksService.setTrunkActive('t1', true)

        expect(PjsipRepository.createTrunk).toHaveBeenCalled()
        expect(db.trunk.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { active: true } })
    })

    it('deactivates custom trunk without touching Asterisk repositories', async () => {
        db.trunk.findUnique
            .mockResolvedValueOnce({ ...TRUNK_WITH_COMPANY, registrationMode: 'custom', active: true })
            .mockResolvedValueOnce({ ...TRUNK, registrationMode: 'custom', active: false })
        db.trunk.update.mockResolvedValue({ ...TRUNK, registrationMode: 'custom', active: false })

        await TrunksService.setTrunkActive('t1', false)

        expect(PjsipRepository.deleteTrunk).not.toHaveBeenCalled()
        expect(db.trunk.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { active: false } })
    })
})

// ─── deleteTrunk ──────────────────────────────────────────────────────────────
describe('TrunksService.deleteTrunk', () => {
    it('throws 404 with non-existent id', async () => {
        db.trunk.findUnique.mockResolvedValue(null)
        await expect(TrunksService.deleteTrunk('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('deletes trunk and resyncs affected outbound routes', async () => {
        db.trunk.findUnique.mockResolvedValue(TRUNK_WITH_COMPANY)
        db.inboundRoute.findMany.mockResolvedValue([])
        db.outboundRouteTrunk.findMany.mockResolvedValue([{ routeId: 'r1' }])
        db.trunk.delete.mockResolvedValue(TRUNK)

        await TrunksService.deleteTrunk('t1')

        expect(db.trunk.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
    })
})
