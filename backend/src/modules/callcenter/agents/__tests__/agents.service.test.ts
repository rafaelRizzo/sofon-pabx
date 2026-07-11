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
mock.module('../cache/agent-scope.cache', () => ({
    AgentScopesCache: {
        getByCompany: mock(() => null), setByCompany: mock(), invalidateByCompany: mock(),
    },
}))

import * as AgentsService from '../agents.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const EXT = { id: 'e1', alias: '2001', name: 'Agent', type: 'pjsip', context: 'ramais', allowOutbound: true, companyId: 'c1', createdAt: new Date(), updatedAt: new Date() }
const SCOPE = { id: 's1', extensionId: 'e1', companyId: 'c1', active: true, createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

describe('AgentsService.getScopesByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(AgentsService.getScopesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns scopes list', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.agentCompanyScope.findMany.mockResolvedValue([SCOPE])
        const scopes = await AgentsService.getScopesByCompany('c1') as any[]
        expect(scopes[0].id).toBe('s1')
    })
})

describe('AgentsService.createScope', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(AgentsService.createScope({ extensionId: 'e1', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', active: true }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(AgentsService.createScope({ extensionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', companyId: 'c1', active: true }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when scope already exists', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.agentCompanyScope.findUnique.mockResolvedValue(SCOPE)
        await expect(AgentsService.createScope({ extensionId: 'e1', companyId: 'c1', active: true }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates scope', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.agentCompanyScope.findUnique.mockResolvedValue(null)
        db.agentCompanyScope.create.mockResolvedValue(SCOPE)
        const scope = await AgentsService.createScope({ extensionId: 'e1', companyId: 'c1', active: true }) as any
        expect(scope.id).toBe('s1')
    })
})

describe('AgentsService.updateScope', () => {
    it('throws 404 when scope not found', async () => {
        db.agentCompanyScope.findUnique.mockResolvedValue(null)
        await expect(AgentsService.updateScope('clxxxxxxxxxxxxxxxxxxxxxxxxx', { active: false }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates scope', async () => {
        db.agentCompanyScope.findUnique.mockResolvedValue(SCOPE)
        db.agentCompanyScope.update.mockResolvedValue({ ...SCOPE, active: false })
        const scope = await AgentsService.updateScope('s1', { active: false }) as any
        expect(scope.active).toBe(false)
    })
})

describe('AgentsService.deleteScope', () => {
    it('throws 404 when scope not found', async () => {
        db.agentCompanyScope.findUnique.mockResolvedValue(null)
        await expect(AgentsService.deleteScope('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('deletes scope', async () => {
        db.agentCompanyScope.findUnique.mockResolvedValue(SCOPE)
        db.agentCompanyScope.delete.mockResolvedValue(SCOPE)
        await AgentsService.deleteScope('s1')
        expect(db.agentCompanyScope.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
    })
})
