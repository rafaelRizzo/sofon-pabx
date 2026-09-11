import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/request-templates.cache', () => ({
    RequestTemplatesCache: {
        getAll: mock(() => null), setAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getTemplate: mock(() => null), setTemplate: mock(),
        invalidateTemplate: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
        invalidateAll: mock(),
        getAgiTemplate: mock(() => null), setAgiTemplate: mock(), invalidateAgiTemplate: mock(),
    },
}))
mock.module('../../../asterisk/request-template.repository', () => ({
    RequestTemplateRepository: { regenerate: mock(() => Promise.resolve()) },
}))

import * as RequestTemplatesService from '../request-templates.service'
import { RequestTemplateRepository } from '../../../asterisk/request-template.repository'

const COMPANY = { id: 'c1', name: 'ACME' }
const TEMPLATE = {
    id: 't1', name: 'crm-lookup', companyId: 'c1', method: 'GET', url: 'https://crm.example.com/{{EXTEN}}',
    headers: null, body: null, timeoutMs: 5000, variableMappings: [],
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

describe('RequestTemplatesService.createRequestTemplate', () => {
    it('creates template and syncs dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.requestTemplate.findUnique.mockResolvedValue(null)
        db.requestTemplate.create.mockResolvedValue(TEMPLATE)

        const template = await RequestTemplatesService.createRequestTemplate({
            name: 'crm-lookup', companyId: 'c1', method: 'GET', url: 'https://crm.example.com/{{EXTEN}}',
            timeoutMs: 5000, variableMappings: [],
        } as any)

        expect(template.id).toBe('t1')
        expect(RequestTemplateRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(RequestTemplatesService.createRequestTemplate({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', method: 'GET', url: 'https://x.com',
            timeoutMs: 5000, variableMappings: [],
        } as any)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.requestTemplate.findUnique.mockResolvedValue(TEMPLATE)
        await expect(RequestTemplatesService.createRequestTemplate({
            name: 'crm-lookup', companyId: 'c1', method: 'GET', url: 'https://x.com',
            timeoutMs: 5000, variableMappings: [],
        } as any)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 when onSuccess points to a missing extension', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.requestTemplate.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(RequestTemplatesService.createRequestTemplate({
            name: 'crm-lookup', companyId: 'c1', method: 'GET', url: 'https://x.com',
            timeoutMs: 5000, variableMappings: [], onSuccess: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        } as any)).rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('RequestTemplatesService.getRequestTemplateById', () => {
    it('returns template', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(TEMPLATE)
        db.flowEdge.findMany.mockResolvedValue([])
        const template = await RequestTemplatesService.getRequestTemplateById('t1') as any
        expect(template.id).toBe('t1')
    })

    it('throws 404 with non-existent id', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(null)
        await expect(RequestTemplatesService.getRequestTemplateById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('RequestTemplatesService.updateRequestTemplate', () => {
    it('updates template fields', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(TEMPLATE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.requestTemplate.update.mockResolvedValue({ ...TEMPLATE, url: 'https://crm.example.com/v2/{{EXTEN}}' })
        const template = await RequestTemplatesService.updateRequestTemplate('t1', { url: 'https://crm.example.com/v2/{{EXTEN}}' }) as any
        expect(template.url).toBe('https://crm.example.com/v2/{{EXTEN}}')
        expect(db.requestTemplate.update).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(null)
        await expect(RequestTemplatesService.updateRequestTemplate('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('RequestTemplatesService.deleteRequestTemplate', () => {
    it('deletes template and removes dialplan entry', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(TEMPLATE)
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia - assertNotReferenced passa
        db.requestTemplate.delete.mockResolvedValue(TEMPLATE)
        await RequestTemplatesService.deleteRequestTemplate('t1')
        expect(RequestTemplateRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.requestTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(null)
        await expect(RequestTemplatesService.deleteRequestTemplate('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.requestTemplate.findUnique.mockResolvedValue(TEMPLATE)
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(RequestTemplatesService.deleteRequestTemplate('t1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.requestTemplate.delete).not.toHaveBeenCalled()
    })
})
