import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as PauseReasonsService from '../pause-reasons.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const REASON = {
    id: 'pr1', companyId: 'c1', label: 'Almoço', active: true,
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

describe('PauseReasonsService.getPauseReasonsByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(PauseReasonsService.getPauseReasonsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns pause reasons list', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.pauseReason.findMany.mockResolvedValue([REASON])
        const reasons = await PauseReasonsService.getPauseReasonsByCompany('c1') as any[]
        expect(reasons[0].id).toBe('pr1')
    })
})

describe('PauseReasonsService.createPauseReason', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(PauseReasonsService.createPauseReason({ companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', label: 'Almoço', active: true }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate label in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.pauseReason.findUnique.mockResolvedValue(REASON)
        await expect(PauseReasonsService.createPauseReason({ companyId: 'c1', label: 'Almoço', active: true }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates pause reason', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.pauseReason.findUnique.mockResolvedValue(null)
        db.pauseReason.create.mockResolvedValue(REASON)
        const reason = await PauseReasonsService.createPauseReason({ companyId: 'c1', label: 'Almoço', active: true }) as any
        expect(reason.id).toBe('pr1')
    })
})

describe('PauseReasonsService.updatePauseReason', () => {
    it('throws 404 when reason not found', async () => {
        db.pauseReason.findUnique.mockResolvedValue(null)
        await expect(PauseReasonsService.updatePauseReason('clxxxxxxxxxxxxxxxxxxxxxxxxx', { active: false }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when new label already in use', async () => {
        db.pauseReason.findUnique.mockResolvedValueOnce(REASON).mockResolvedValueOnce({ ...REASON, id: 'pr2' })
        await expect(PauseReasonsService.updatePauseReason('pr1', { label: 'Reunião' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('updates pause reason', async () => {
        db.pauseReason.findUnique.mockResolvedValueOnce(REASON)
        db.pauseReason.update.mockResolvedValue({ ...REASON, active: false })
        const reason = await PauseReasonsService.updatePauseReason('pr1', { active: false }) as any
        expect(reason.active).toBe(false)
    })
})

describe('PauseReasonsService.deletePauseReason', () => {
    it('throws 404 when reason not found', async () => {
        db.pauseReason.findUnique.mockResolvedValue(null)
        await expect(PauseReasonsService.deletePauseReason('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('deletes pause reason', async () => {
        db.pauseReason.findUnique.mockResolvedValue(REASON)
        db.pauseReason.delete.mockResolvedValue(REASON)
        await PauseReasonsService.deletePauseReason('pr1')
        expect(db.pauseReason.delete).toHaveBeenCalledWith({ where: { id: 'pr1' } })
    })
})
