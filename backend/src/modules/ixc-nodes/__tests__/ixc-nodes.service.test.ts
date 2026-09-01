import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/ixc-nodes.cache', () => ({
    IxcNodesCache: {
        getAll: mock(() => null), setAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getNode: mock(() => null), setNode: mock(),
        invalidateNode: mock(), invalidateByCompany: mock(), invalidateAll: mock(),
    },
}))
mock.module('../../../asterisk/destinations/ixc-node.repository', () => ({
    IxcNodeRepository: { regenerate: mock(() => Promise.resolve()) },
}))
mock.module('../../../lib/crypto', () => ({
    decryptForCompany: mock(() => 'plain-token'),
}))
mock.module('../../../integrations/ixc/client', () => ({
    runIxcAction: mock(),
}))

import * as IxcNodesService from '../ixc-nodes.service'
import { runIxcAction } from '../../../integrations/ixc/client'

const COMPANY = { id: 'c1', name: 'ACME' }
const CREDENTIAL = {
    id: 'cred1', companyId: 'c1', provider: 'ixc', name: 'IXC PHONEVOX',
    baseUrl: 'https://ixc.example.com', tokenCiphertext: 'x', tokenIv: 'y', tokenTag: 'z',
}

beforeEach(() => {
    clearPrismaMock(db)
    ;(runIxcAction as any).mockReset()
})

describe('IxcNodesService.testIxcNode', () => {
    it('decrypts the credential and returns the raw IXC response', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.integrationCredential.findUnique.mockResolvedValue(CREDENTIAL)
        ;(runIxcAction as any).mockResolvedValue({
            url: 'https://ixc.example.com/webservice/v1/cliente',
            payload: { qtype: 'cliente.cnpj_cpf', query: '123', oper: '=' },
            status: 200,
            ok: true,
            rawBody: '{"cliente":[{"id":"1"}]}',
            data: { cliente: [{ id: '1' }] },
        })

        const result = await IxcNodesService.testIxcNode({
            companyId: 'c1', credentialId: 'cred1', action: 'listar_cliente',
            params: { query: '123' }, timeoutMs: 5000,
        })

        expect(result.ok).toBe(true)
        expect(result.status).toBe(200)
        expect(result.data).toEqual({ cliente: [{ id: '1' }] })
        expect(runIxcAction).toHaveBeenCalledWith(
            { baseUrl: 'https://ixc.example.com', token: 'plain-token' },
            'listar_cliente',
            { query: '123' },
            expect.anything(),
        )
    })

    it('throws 403 when the credential belongs to a different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.integrationCredential.findUnique.mockResolvedValue({ ...CREDENTIAL, companyId: 'c2' })

        await expect(
            IxcNodesService.testIxcNode({ companyId: 'c1', credentialId: 'cred1', action: 'listar_cliente', timeoutMs: 5000 }),
        ).rejects.toMatchObject({ statusCode: 403 })
        expect(runIxcAction).not.toHaveBeenCalled()
    })

    it('wraps a network failure as a 502 AppError', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.integrationCredential.findUnique.mockResolvedValue(CREDENTIAL)
        ;(runIxcAction as any).mockRejectedValue(new Error('fetch failed'))

        await expect(
            IxcNodesService.testIxcNode({ companyId: 'c1', credentialId: 'cred1', action: 'listar_cliente', timeoutMs: 5000 }),
        ).rejects.toMatchObject({ statusCode: 502, message: expect.stringContaining('fetch failed') })
    })
})
