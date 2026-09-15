import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../lib/prisma', () => ({ prisma: db }))
mock.module('../dialplan/route-destination-resolver', () => ({
    resolveRouteDestinationToDialplan: mock(() =>
        Promise.resolve({ context: 'ivrs', exten: 'ivr-1', priority: 1 })
    ),
}))
// Não mockar FlowEdgeRepository (compartilhado por muitos módulos, ver route-destination-label.ts
// e afins) - mock.module vaza entre arquivos de teste no bun, quebrando quem não mocka esse módulo
// e espera o real. Em vez disso, dirige o comportamento via prisma.flowEdge.findMany (já mockado).
import { InboundRouteRepository } from '../destinations/inboundroute.repository'

function fakeTx() {
    return {
        extensions: {
            deleteMany: mock(() => Promise.resolve({ count: 0 })),
            createMany: mock(() => Promise.resolve({ count: 0 })),
        },
    } as any
}

beforeEach(() => clearPrismaMock(db))

describe('InboundRouteRepository dialplan shape', () => {
    it('builds the full sequence with MixMonitor + CDR recording (no maxIn)', async () => {
        const tx = fakeTx()

        await InboundRouteRepository.create(tx, 'trunk1', 'ast1', '5511999998888', null, null)

        const { data } = tx.extensions.createMany.mock.calls[0][0]
        expect(data.map((d: any) => d.app)).toEqual([
            'Set', 'Set', 'Set', 'Set', 'Set', 'Set', 'Set', 'Answer', 'Wait', 'Set', 'MixMonitor', 'Set', 'Goto',
        ])
        expect(data[0]).toEqual(expect.objectContaining({
            app: 'Set',
            appdata: 'CHANNEL(accountcode)=${IF($["${RESOLVED_ACCOUNTCODE}" != ""]?${RESOLVED_ACCOUNTCODE}:${CHANNEL(accountcode)})}',
        }))
        expect(data).toContainEqual(
            expect.objectContaining({ app: 'Set', appdata: 'CDR(entry_trunk_id)=${TRUNKID}' })
        )
        expect(data).toContainEqual(
            expect.objectContaining({ app: 'Set', appdata: '__TRANSFER_CONTEXT=transfer' })
        )
        expect(data).toContainEqual(
            expect.objectContaining({
                app: 'Set',
                appdata: 'CDR(recording_file)=${MIXMONITOR_FILENAME}',
            })
        )
        expect(data).toContainEqual(
            expect.objectContaining({ app: 'MixMonitor', appdata: '${MIXMONITOR_FILENAME},b' })
        )
    })

    it('computes the GotoIf jump target dynamically when maxIn is set', async () => {
        const tx = fakeTx()

        await InboundRouteRepository.create(tx, 'trunk1', 'ast1', '5511999998888', null, 5)

        const { data } = tx.extensions.createMany.mock.calls[0][0]
        const gotoIf = data.find((d: any) => d.app === 'GotoIf')
        const congestion = data.find((d: any) => d.app === 'Congestion')
        expect(gotoIf).toBeDefined()
        expect(congestion).toBeDefined()
        expect(gotoIf.appdata).toBe(
            `$[\${GROUP_COUNT(in-trunk1)} > 5]?${congestion.priority}`
        )
    })

    it('update deletes existing entries for that trunk+did before recreating', async () => {
        const tx = fakeTx()

        await InboundRouteRepository.update(tx, 'trunk1', 'ast1', '5511999998888', null, null)

        expect(tx.extensions.deleteMany).toHaveBeenCalledWith({
            where: { context: 'from-trunk-routed', exten: '5511999998888_ast1' },
        })
    })
})

describe('InboundRouteRepository.regenerateAll', () => {
    it('does nothing when the company does not exist', async () => {
        db.company.findUnique.mockResolvedValue(null)

        await InboundRouteRepository.regenerateAll('c1')

        expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('does nothing when the company has no inbound routes', async () => {
        db.company.findUnique.mockResolvedValue({ asteriskId: 'ast1' })
        db.inboundRoute.findMany.mockResolvedValue([])

        await InboundRouteRepository.regenerateAll('c1')

        expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('regenerates every inbound route using its current destination and trunk maxInChannels', async () => {
        db.company.findUnique.mockResolvedValue({ asteriskId: 'ast1' })
        db.inboundRoute.findMany.mockResolvedValue([
            { id: 'ir1', trunkId: 'trunk1', did: { number: '5511999998888' }, trunk: { maxInChannels: 5 } },
        ])
        db.flowEdge.findMany.mockResolvedValue([
            { sourceId: 'ir1', slot: 'default', targetType: 'ivr', targetId: 'ivr1' },
        ])

        await InboundRouteRepository.regenerateAll('c1')

        expect(db.$transaction).toHaveBeenCalled()
        expect(db.extensions.deleteMany).toHaveBeenCalledWith({
            where: { context: 'from-trunk-routed', exten: '5511999998888_ast1' },
        })
    })
})
