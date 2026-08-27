import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/variable-conditions.cache', () => ({
    VariableConditionsCache: {
        getAll: mock(() => null), setAll: mock(), invalidateAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getVariableCondition: mock(() => null), setVariableCondition: mock(),
        invalidateVariableCondition: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/variablecondition.repository', () => ({
    VariableConditionRepository: { regenerate: mock(() => Promise.resolve()) },
}))

import * as VariableConditionsService from '../variable-conditions.service'
import { VariableConditionRepository } from '../../../asterisk/variablecondition.repository'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const EXT = { id: 'e1', companyId: 'c1', context: 'ramais', number: '1001' }
const VARCOND = {
    id: 'vc1', name: 'CPF valido', companyId: 'c1', combinator: 'and',
    rules: [{ variable: 'CPF', operator: 'length_eq', value: '11' }],
    trueRoute: { type: 'hangup' }, falseRoute: { type: 'extension', id: 'e1' },
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

// ─── createVariableCondition ────────────────────────────────────────────────────
describe('VariableConditionsService.createVariableCondition', () => {
    it('creates condition with default combinator and regenerates dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableCondition.findUnique.mockResolvedValueOnce(null) // dup check
        db.extension.findUnique.mockResolvedValue(EXT)
        db.variableCondition.create.mockResolvedValue(VARCOND)
        const created = await VariableConditionsService.createVariableCondition({
            name: 'CPF valido', companyId: 'c1', combinator: 'and',
            rules: [{ variable: 'CPF', operator: 'length_eq', value: '11' }],
            falseRoute: { type: 'extension', id: 'e1' },
        })
        expect(created.id).toBe('vc1')
        expect(VariableConditionRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableCondition.findUnique.mockResolvedValue(VARCOND)
        await expect(VariableConditionsService.createVariableCondition({
            name: 'CPF valido', companyId: 'c1', combinator: 'and', rules: [{ variable: 'X', operator: 'filled' }],
        })).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(VariableConditionsService.createVariableCondition({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', combinator: 'and', rules: [{ variable: 'X', operator: 'filled' }],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when falseRoute extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variableCondition.findUnique.mockResolvedValueOnce(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(VariableConditionsService.createVariableCondition({
            name: 'x', companyId: 'c1', combinator: 'and', rules: [{ variable: 'X', operator: 'filled' }],
            falseRoute: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getVariableConditionById ───────────────────────────────────────────────────
describe('VariableConditionsService.getVariableConditionById', () => {
    it('returns condition by id', async () => {
        db.variableCondition.findUnique.mockResolvedValue(VARCOND)
        db.flowEdge.findMany.mockResolvedValue([])
        const found = await VariableConditionsService.getVariableConditionById('vc1') as any
        expect(found.id).toBe('vc1')
    })

    it('throws 404 with non-existent id', async () => {
        db.variableCondition.findUnique.mockResolvedValue(null)
        await expect(VariableConditionsService.getVariableConditionById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateVariableCondition ────────────────────────────────────────────────────
describe('VariableConditionsService.updateVariableCondition', () => {
    it('replaces rules and combinator, regenerates dialplan', async () => {
        db.variableCondition.findUnique.mockResolvedValueOnce(VARCOND) // existing
        db.variableCondition.update.mockResolvedValue({ ...VARCOND, combinator: 'or' })
        db.flowEdge.findMany.mockResolvedValue([])
        const updated = await VariableConditionsService.updateVariableCondition('vc1', { combinator: 'or' }) as any
        expect(updated.combinator).toBe('or')
        expect(VariableConditionRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.variableCondition.findUnique.mockResolvedValue(null)
        await expect(VariableConditionsService.updateVariableCondition('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteVariableCondition ────────────────────────────────────────────────────
describe('VariableConditionsService.deleteVariableCondition', () => {
    it('deletes condition and regenerates dialplan', async () => {
        db.variableCondition.findUnique.mockResolvedValue({ id: 'vc1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia - assertNotReferenced passa
        db.variableCondition.delete.mockResolvedValue(VARCOND)
        await VariableConditionsService.deleteVariableCondition('vc1')
        expect(VariableConditionRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.variableCondition.delete).toHaveBeenCalledWith({ where: { id: 'vc1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.variableCondition.findUnique.mockResolvedValue(null)
        await expect(VariableConditionsService.deleteVariableCondition('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.variableCondition.findUnique.mockResolvedValue({ id: 'vc1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(VariableConditionsService.deleteVariableCondition('vc1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.variableCondition.delete).not.toHaveBeenCalled()
    })
})
