import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as VariableCatalogService from '../variable-catalog.service'

const COMPANY = { id: 'c1', name: 'ACME' }
const VARIABLE = {
    id: 'var1', name: 'CPF_CLIENTE', companyId: 'c1', description: null as string | null,
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

// ─── createVariable ─────────────────────────────────────────────────────────────
describe('VariableCatalogService.createVariable', () => {
    it('creates a variable', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variable.findUnique.mockResolvedValueOnce(null) // dup check
        db.variable.create.mockResolvedValue(VARIABLE)
        const created = await VariableCatalogService.createVariable({ name: 'CPF_CLIENTE', companyId: 'c1' })
        expect(created.id).toBe('var1')
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.variable.findUnique.mockResolvedValue(VARIABLE)
        await expect(VariableCatalogService.createVariable({ name: 'CPF_CLIENTE', companyId: 'c1' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(VariableCatalogService.createVariable({ name: 'X', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateVariable ─────────────────────────────────────────────────────────────
describe('VariableCatalogService.updateVariable', () => {
    it('renames a variable', async () => {
        db.variable.findUnique.mockResolvedValueOnce(VARIABLE).mockResolvedValueOnce(null) // existing, then dup check
        db.variable.update.mockResolvedValue({ ...VARIABLE, name: 'CPF_NOVO' })
        const updated = await VariableCatalogService.updateVariable('var1', { name: 'CPF_NOVO' }) as any
        expect(updated.name).toBe('CPF_NOVO')
    })

    it('throws 404 with non-existent id', async () => {
        db.variable.findUnique.mockResolvedValue(null)
        await expect(VariableCatalogService.updateVariable('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when renaming to a name already in use', async () => {
        db.variable.findUnique.mockResolvedValueOnce(VARIABLE).mockResolvedValueOnce({ ...VARIABLE, id: 'var2' })
        await expect(VariableCatalogService.updateVariable('var1', { name: 'ocupado' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })
})

// ─── deleteVariable ─────────────────────────────────────────────────────────────
describe('VariableCatalogService.deleteVariable', () => {
    it('deletes a variable not referenced anywhere', async () => {
        db.variable.findUnique.mockResolvedValue(VARIABLE)
        db.ivrMenu.findMany.mockResolvedValue([])
        db.variableSet.findMany.mockResolvedValue([])
        await VariableCatalogService.deleteVariable('var1')
        expect(db.variable.delete).toHaveBeenCalledWith({ where: { id: 'var1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.variable.findUnique.mockResolvedValue(null)
        await expect(VariableCatalogService.deleteVariable('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when in use by an IVR menu', async () => {
        db.variable.findUnique.mockResolvedValue(VARIABLE)
        db.ivrMenu.findMany.mockResolvedValue([{ name: 'coleta-cpf' }])
        db.variableSet.findMany.mockResolvedValue([])
        await expect(VariableCatalogService.deleteVariable('var1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.variable.delete).not.toHaveBeenCalled()
    })

    it('throws 409 when in use by a VariableSet assignment', async () => {
        db.variable.findUnique.mockResolvedValue(VARIABLE)
        db.ivrMenu.findMany.mockResolvedValue([])
        db.variableSet.findMany.mockResolvedValue([
            { name: 'Seta CRM', assignments: [{ variable: 'CPF_CLIENTE', value: '1' }] },
        ])
        await expect(VariableCatalogService.deleteVariable('var1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.variable.delete).not.toHaveBeenCalled()
    })
})

// ─── assertVariableExistsForCompany ──────────────────────────────────────────────
describe('VariableCatalogService.assertVariableExistsForCompany', () => {
    it('resolves when the variable exists for the company', async () => {
        db.variable.findUnique.mockResolvedValue({ id: 'var1' })
        await expect(VariableCatalogService.assertVariableExistsForCompany('CPF_CLIENTE', 'c1')).resolves.toBeUndefined()
    })

    it('throws 404 when the variable does not exist for the company', async () => {
        db.variable.findUnique.mockResolvedValue(null)
        await expect(VariableCatalogService.assertVariableExistsForCompany('CPF_CLIENTE', 'c1'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
