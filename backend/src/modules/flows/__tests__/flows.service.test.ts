import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/flows.cache', () => ({
    FlowsCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        getFlow: mock(() => null), setFlow: mock(),
        invalidateFlow: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/flow.repository', () => ({
    FlowRepository: { regenerate: mock(() => Promise.resolve()) },
}))

import * as FlowsService from '../flows.service'
import { FlowRepository } from '../../../asterisk/flow.repository'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const FLOW = { id: 'f1', name: 'atendimento-comercial', companyId: 'c1', layout: [], createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── createFlow ─────────────────────────────────────────────────────────────────
describe('FlowsService.createFlow', () => {
    it('creates flow without entryDestination', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.flow.findUnique.mockResolvedValueOnce(null) // dup check
        db.flow.create.mockResolvedValue(FLOW)
        const flow = await FlowsService.createFlow({ name: 'atendimento-comercial', companyId: 'c1' })
        expect(flow.id).toBe('f1')
        expect(flow.entryDestination).toBeNull()
        expect(FlowRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('creates flow pointing to an announcement', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.flow.findUnique.mockResolvedValueOnce(null)
        db.announcement.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.flow.create.mockResolvedValue(FLOW)
        const flow = await FlowsService.createFlow({
            name: 'atendimento-comercial', companyId: 'c1',
            entryDestination: { type: 'announcement', id: 'ann1' },
        })
        expect(flow.entryDestination).toEqual({ type: 'announcement', id: 'ann1' })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.flow.findUnique.mockResolvedValue(FLOW)
        await expect(FlowsService.createFlow({ name: 'atendimento-comercial', companyId: 'c1' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(FlowsService.createFlow({ name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getFlowById ────────────────────────────────────────────────────────────────
describe('FlowsService.getFlowById', () => {
    it('returns flow by id', async () => {
        db.flow.findUnique.mockResolvedValue(FLOW)
        db.flowEdge.findMany.mockResolvedValue([])
        const flow = await FlowsService.getFlowById('f1') as any
        expect(flow.id).toBe('f1')
    })

    it('throws 404 with non-existent id', async () => {
        db.flow.findUnique.mockResolvedValue(null)
        await expect(FlowsService.getFlowById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateFlow ─────────────────────────────────────────────────────────────────
describe('FlowsService.updateFlow', () => {
    it('updates name', async () => {
        db.flow.findUnique.mockResolvedValueOnce(FLOW).mockResolvedValueOnce(null)
        db.flowEdge.findMany.mockResolvedValue([])
        db.flow.update.mockResolvedValue({ ...FLOW, name: 'novo-nome' })
        const flow = await FlowsService.updateFlow('f1', { name: 'novo-nome' }) as any
        expect(flow.name).toBe('novo-nome')
        expect(FlowRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.flow.findUnique.mockResolvedValue(null)
        await expect(FlowsService.updateFlow('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteFlow ─────────────────────────────────────────────────────────────────
describe('FlowsService.deleteFlow', () => {
    it('deletes flow', async () => {
        db.flow.findUnique.mockResolvedValue({ id: 'f1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([])
        db.flow.delete.mockResolvedValue(FLOW)
        await FlowsService.deleteFlow('f1')
        expect(FlowRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.flow.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.flow.findUnique.mockResolvedValue(null)
        await expect(FlowsService.deleteFlow('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.flow.findUnique.mockResolvedValue({ id: 'f1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(FlowsService.deleteFlow('f1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.flow.delete).not.toHaveBeenCalled()
    })
})

// ─── getFlowGraph ───────────────────────────────────────────────────────────────
describe('FlowsService.getFlowGraph', () => {
    it('returns empty graph when entryDestination is hangup', async () => {
        db.flow.findUnique.mockResolvedValue({ id: 'f1' })
        db.flowEdge.findMany.mockResolvedValue([])
        const graph = await FlowsService.getFlowGraph('f1')
        expect(graph).toEqual({ nodes: [], edges: [] })
    })

    it('walks a simple chain: announcement -> queue', async () => {
        db.flow.findUnique.mockResolvedValue({ id: 'f1' })
        // 1a chamada: FlowEdgeRepository.getOne('flow','f1','entry') -> announcement ann1
        db.flowEdge.findUnique
            .mockResolvedValueOnce({ targetType: 'announcement', targetId: 'ann1' }) // flow entry
            .mockResolvedValueOnce({ targetType: 'queue', targetId: 'q1' }) // announcement -> queue
            .mockResolvedValueOnce(null) // queue -> nothing
        db.announcement.findUnique.mockResolvedValue({ name: 'Fora do horário' })
        db.queue.findUnique.mockResolvedValue({ name: 'Comercial', number: '5000' })

        const graph = await FlowsService.getFlowGraph('f1')

        expect(graph.nodes).toEqual([
            { type: 'announcement', id: 'ann1', name: 'Fora do horário' },
            { type: 'queue', id: 'q1', name: 'Comercial (5000)' },
        ])
        expect(graph.edges).toEqual([
            { from: { type: 'announcement', id: 'ann1', slot: 'default' }, to: { type: 'queue', id: 'q1' } },
        ])
    })

    it('throws 404 with non-existent flow id', async () => {
        db.flow.findUnique.mockResolvedValue(null)
        await expect(FlowsService.getFlowGraph('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
