import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/variables.cache', () => ({
    VariablesCache: {
        getAll: mock(() => null), setAll: mock(), invalidateAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getVariableSet: mock(() => null), setVariableSet: mock(),
        invalidateVariableSet: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/variable.repository', () => ({
    VariableRepository: { regenerate: mock(() => Promise.resolve()) },
}))

import * as VariablesService from '../variables.service'
import { VariableRepository } from '../../../asterisk/variable.repository'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const VARSET = {
    id: 'v1', name: 'Seta CRM', companyId: 'c1',
    assignments: [{ variable: 'CRM_ID', value: '123' }],
    destination: null, createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

// ─── createVariableSet ──────────────────────────────────────────────────────────
describe('VariablesService.createVariableSet', () => {
    it('creates a variable set and regenerates dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableSet.findUnique.mockResolvedValueOnce(null) // dup check
        db.variable.findUnique.mockResolvedValue({ id: 'catalog1' })
        db.variableSet.create.mockResolvedValue(VARSET)
        const created = await VariablesService.createVariableSet({
            name: 'Seta CRM', companyId: 'c1', assignments: [{ variable: 'CRM_ID', value: '123' }],
        })
        expect(created.id).toBe('v1')
        expect(VariableRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('validates destination against the same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableSet.findUnique.mockResolvedValueOnce(null)
        db.variable.findUnique.mockResolvedValue({ id: 'catalog1' })
        db.extension.findUnique.mockResolvedValue(null)
        await expect(VariablesService.createVariableSet({
            name: 'x', companyId: 'c1', assignments: [{ variable: 'X', value: '1' }],
            destination: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableSet.findUnique.mockResolvedValue(VARSET)
        await expect(VariablesService.createVariableSet({
            name: 'Seta CRM', companyId: 'c1', assignments: [{ variable: 'X', value: '1' }],
        })).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(VariablesService.createVariableSet({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', assignments: [{ variable: 'X', value: '1' }],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when an assignment references a variable not declared in the catalog', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableSet.findUnique.mockResolvedValueOnce(null)
        db.variable.findUnique.mockResolvedValue(null)
        await expect(VariablesService.createVariableSet({
            name: 'x', companyId: 'c1', assignments: [{ variable: 'X', value: '1' }],
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getVariableSetById ─────────────────────────────────────────────────────────
describe('VariablesService.getVariableSetById', () => {
    it('returns variable set by id', async () => {
        db.variableSet.findUnique.mockResolvedValue(VARSET)
        db.flowEdge.findMany.mockResolvedValue([])
        const found = await VariablesService.getVariableSetById('v1') as any
        expect(found.id).toBe('v1')
    })

    it('throws 404 with non-existent id', async () => {
        db.variableSet.findUnique.mockResolvedValue(null)
        await expect(VariablesService.getVariableSetById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateVariableSet ──────────────────────────────────────────────────────────
describe('VariablesService.updateVariableSet', () => {
    it('replaces assignments and regenerates dialplan', async () => {
        db.variableSet.findUnique.mockResolvedValueOnce(VARSET) // existing
        db.variable.findUnique.mockResolvedValue({ id: 'catalog1' })
        db.flowEdge.findMany.mockResolvedValue([])
        db.variableSet.update.mockResolvedValue({ ...VARSET, assignments: [{ variable: 'X', value: '2' }] })
        const updated = await VariablesService.updateVariableSet('v1', { assignments: [{ variable: 'X', value: '2' }] }) as any
        expect(updated.assignments).toEqual([{ variable: 'X', value: '2' }])
        expect(VariableRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.variableSet.findUnique.mockResolvedValue(null)
        await expect(VariablesService.updateVariableSet('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when a new assignment references a variable not declared in the catalog', async () => {
        db.variableSet.findUnique.mockResolvedValueOnce(VARSET)
        db.variable.findUnique.mockResolvedValue(null)
        await expect(VariablesService.updateVariableSet('v1', { assignments: [{ variable: 'X', value: '2' }] }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteVariableSet ───────────────────────────────────────────────────────────
describe('VariablesService.deleteVariableSet', () => {
    it('deletes variable set and regenerates dialplan', async () => {
        db.variableSet.findUnique.mockResolvedValue({ id: 'v1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia - assertNotReferenced passa
        db.variableSet.delete.mockResolvedValue(VARSET)
        await VariablesService.deleteVariableSet('v1')
        expect(VariableRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.variableSet.delete).toHaveBeenCalledWith({ where: { id: 'v1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.variableSet.findUnique.mockResolvedValue(null)
        await expect(VariablesService.deleteVariableSet('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.variableSet.findUnique.mockResolvedValue({ id: 'v1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(VariablesService.deleteVariableSet('v1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.variableSet.delete).not.toHaveBeenCalled()
    })
})
