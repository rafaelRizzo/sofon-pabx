import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../cache/extensions.cache', () => ({
    ExtensionsCache: {
        getAllExtensions: mock(() => null), setAllExtensions: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getExtension: mock(() => null), setExtension: mock(),
        invalidateExtension: mock(), invalidateAllExtensions: mock(),
    },
}))
mock.module('../../../asterisk/pjsip.repository', () => ({
    PjsipRepository: {
        createExtension: mock(() => Promise.resolve()),
        updateExtension: mock(() => Promise.resolve()),
        renameExtension: mock(() => Promise.resolve()),
        deleteExtension: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/sip.repository', () => ({
    SipRepository: {
        createExtension: mock(() => Promise.resolve()),
        updateExtension: mock(() => Promise.resolve()),
        renameExtension: mock(() => Promise.resolve()),
        deleteExtension: mock(() => Promise.resolve()),
        deleteManyByNames: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/dialplan.repository', () => ({
    DialplanRepository: {
        create: mock(() => Promise.resolve()),
        update: mock(() => Promise.resolve()),
        deleteManyByExten: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/queue.repository', () => ({
    AsteriskQueueRepository: { removeMembersByInterfaces: mock(() => Promise.resolve()) },
}))

import * as ExtensionsService from '../extensions.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const EXT_DB = { id: 'e1', alias: '2001', number: '2001_ast1', type: 'pjsip', name: 'Test', context: 'ramais', allowOutbound: true, companyId: 'c1', createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── createExtension ──────────────────────────────────────────────────────────
describe('ExtensionsService.createExtension', () => {
    it('throws 409 when alias already exists in company', async () => {
        db.extension.findUnique.mockResolvedValue(EXT_DB)
        await expect(ExtensionsService.createExtension({ alias: '2001', type: 'pjsip', name: 'Test', companyId: 'c1', context: 'ramais' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 when company not found', async () => {
        db.extension.findUnique.mockResolvedValue(null)
        db.company.findUnique.mockResolvedValue(null)
        await expect(ExtensionsService.createExtension({ alias: '2002', type: 'pjsip', name: 'Test', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', context: 'ramais' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('creates pjsip extension and returns password', async () => {
        db.extension.findUnique
            .mockResolvedValueOnce(null)           // duplicate check
            .mockResolvedValueOnce({ id: 'e1' })   // after create (findUnique for id)
            .mockResolvedValueOnce(EXT_DB)          // getExtensionById
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ps_endpoints.findUnique
            .mockResolvedValueOnce(null)            // Asterisk number conflict check
            .mockResolvedValueOnce({ id: '2001_ast1' }) // checkAsteriskSync
        db.extension.create.mockResolvedValue(EXT_DB)

        const ext = await ExtensionsService.createExtension({ alias: '2001', type: 'pjsip', name: 'Test', companyId: 'c1', context: 'ramais' }) as any
        expect(ext).toHaveProperty('password')
        expect(typeof ext.password).toBe('string')
    })
})

// ─── getExtensionById ─────────────────────────────────────────────────────────
describe('ExtensionsService.getExtensionById', () => {
    it('throws 404 with non-existent id', async () => {
        db.extension.findUnique.mockResolvedValue(null)
        await expect(ExtensionsService.getExtensionById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns extension with synced status', async () => {
        db.extension.findUnique.mockResolvedValue(EXT_DB)
        db.ps_endpoints.findUnique.mockResolvedValue({ id: '2001_ast1' })
        const ext = await ExtensionsService.getExtensionById('e1') as any
        expect(ext.id).toBe('e1')
        expect(typeof ext.synced).toBe('boolean')
    })
})

// ─── updateExtension ──────────────────────────────────────────────────────────
describe('ExtensionsService.updateExtension', () => {
    it('throws 404 with non-existent id', async () => {
        db.extension.findUnique.mockResolvedValue(null)
        await expect(ExtensionsService.updateExtension('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── resetExtensionPassword ───────────────────────────────────────────────────
describe('ExtensionsService.resetExtensionPassword', () => {
    it('throws 404 with non-existent id', async () => {
        db.extension.findUnique.mockResolvedValue(null)
        await expect(ExtensionsService.resetExtensionPassword('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteExtension ──────────────────────────────────────────────────────────
describe('ExtensionsService.deleteExtension', () => {
    it('throws 404 with non-existent id', async () => {
        db.extension.findUnique.mockResolvedValue(null)
        await expect(ExtensionsService.deleteExtension('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
