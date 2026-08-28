import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/formatter-nodes.cache', () => ({
    FormatterNodesCache: {
        getAll: mock(() => null), setAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getNode: mock(() => null), setNode: mock(),
        invalidateNode: mock(), invalidateByCompany: mock(), invalidateAll: mock(),
    },
}))
mock.module('../../../asterisk/destinations/formatter-node.repository', () => ({
    FormatterNodeRepository: { regenerate: mock(() => Promise.resolve()) },
}))

import * as FormatterNodesService from '../formatter-nodes.service'
import { FormatterNodeRepository } from '../../../asterisk/destinations/formatter-node.repository'

const COMPANY = { id: 'c1', name: 'ACME' }
const NODE = {
    id: 'f1', name: 'formata-cpf-cnpj', companyId: 'c1',
    inputVariable: 'CPF_CNPJ', outputVariable: 'CPF_CNPJ_FMT',
    masks: ['000.000.000-00', '00.000.000/0000-00'],
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

describe('FormatterNodesService.createFormatterNode', () => {
    it('creates node and syncs dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.formatterNode.findUnique.mockResolvedValue(null)
        db.formatterNode.create.mockResolvedValue(NODE)

        const node = await FormatterNodesService.createFormatterNode({
            name: 'formata-cpf-cnpj', companyId: 'c1',
            inputVariable: 'CPF_CNPJ', outputVariable: 'CPF_CNPJ_FMT',
            masks: ['000.000.000-00', '00.000.000/0000-00'],
        } as any)

        expect(node.id).toBe('f1')
        expect(FormatterNodeRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(FormatterNodesService.createFormatterNode({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
            inputVariable: 'CPF_CNPJ', outputVariable: 'CPF_CNPJ_FMT', masks: ['000.000.000-00'],
        } as any)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.formatterNode.findUnique.mockResolvedValue(NODE)
        await expect(FormatterNodesService.createFormatterNode({
            name: 'formata-cpf-cnpj', companyId: 'c1',
            inputVariable: 'CPF_CNPJ', outputVariable: 'CPF_CNPJ_FMT', masks: ['000.000.000-00'],
        } as any)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 when onSuccess points to a missing extension', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.formatterNode.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(FormatterNodesService.createFormatterNode({
            name: 'formata-cpf-cnpj', companyId: 'c1',
            inputVariable: 'CPF_CNPJ', outputVariable: 'CPF_CNPJ_FMT', masks: ['000.000.000-00'],
            onSuccess: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        } as any)).rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('FormatterNodesService.getFormatterNodeById', () => {
    it('returns node', async () => {
        db.formatterNode.findUnique.mockResolvedValue(NODE)
        db.flowEdge.findMany.mockResolvedValue([])
        const node = await FormatterNodesService.getFormatterNodeById('f1') as any
        expect(node.id).toBe('f1')
        expect(node.masks).toEqual(['000.000.000-00', '00.000.000/0000-00'])
    })

    it('throws 404 with non-existent id', async () => {
        db.formatterNode.findUnique.mockResolvedValue(null)
        await expect(FormatterNodesService.getFormatterNodeById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('FormatterNodesService.updateFormatterNode', () => {
    it('updates node fields', async () => {
        db.formatterNode.findUnique.mockResolvedValue(NODE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.formatterNode.update.mockResolvedValue({ ...NODE, masks: ['00000-000'] })
        const node = await FormatterNodesService.updateFormatterNode('f1', { masks: ['00000-000'] }) as any
        expect(node.masks).toEqual(['00000-000'])
        expect(db.formatterNode.update).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.formatterNode.findUnique.mockResolvedValue(null)
        await expect(FormatterNodesService.updateFormatterNode('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('FormatterNodesService.deleteFormatterNode', () => {
    it('deletes node and removes dialplan entry', async () => {
        db.formatterNode.findUnique.mockResolvedValue(NODE)
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia - assertNotReferenced passa
        db.flowNode.findMany.mockResolvedValue([])
        db.formatterNode.delete.mockResolvedValue(NODE)
        await FormatterNodesService.deleteFormatterNode('f1')
        expect(FormatterNodeRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.formatterNode.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.formatterNode.findUnique.mockResolvedValue(null)
        await expect(FormatterNodesService.deleteFormatterNode('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.formatterNode.findUnique.mockResolvedValue(NODE)
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        db.flowNode.findMany.mockResolvedValue([])
        await expect(FormatterNodesService.deleteFormatterNode('f1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.formatterNode.delete).not.toHaveBeenCalled()
    })
})
