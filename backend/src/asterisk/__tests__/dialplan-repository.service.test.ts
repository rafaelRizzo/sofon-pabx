import { describe, it, expect, mock } from 'bun:test'
import { DialplanRepository } from '../dialplan/dialplan.repository'

function fakeTx() {
    return {
        extensions: {
            deleteMany: mock(() => Promise.resolve({ count: 0 })),
            createMany: mock(() => Promise.resolve({ count: 0 })),
        },
    } as any
}

describe('DialplanRepository.ensureGenericRoutingPattern', () => {
    it('deletes existing rows for the pattern before recreating, without skipDuplicates', async () => {
        const tx = fakeTx()

        await DialplanRepository.ensureGenericRoutingPattern(tx, 'ramais')

        expect(tx.extensions.deleteMany).toHaveBeenCalledWith({
            where: { context: 'ramais', exten: { in: ['_XX', '_XXX', '_XXXX', '_XXXXX', '_XXXXXX'] } },
        })
        expect(tx.extensions.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
            tx.extensions.createMany.mock.invocationCallOrder[0]
        )

        const { data, skipDuplicates } = tx.extensions.createMany.mock.calls[0][0]
        expect(skipDuplicates).toBeUndefined()
        // 5 tamanhos de alias (2-6 dígitos) x 10 prioridades cada
        expect(data).toHaveLength(50)
        expect(data).toContainEqual({
            context: 'ramais',
            exten: '_XXXX',
            priority: 6,
            app: 'Set',
            appdata: 'CDR(recording_file)=${MIXMONITOR_FILENAME}',
        })
    })
})

describe('DialplanRepository.ensureFallback', () => {
    it('deletes existing fallback rows before recreating, without skipDuplicates', async () => {
        const tx = fakeTx()

        await DialplanRepository.ensureFallback(tx, 'ramais')

        expect(tx.extensions.deleteMany).toHaveBeenCalledWith({
            where: { context: 'ramais', exten: '_X.' },
        })
        const { data, skipDuplicates } = tx.extensions.createMany.mock.calls[0][0]
        expect(skipDuplicates).toBeUndefined()
        expect(data).toHaveLength(4)
        expect(data).toContainEqual({
            context: 'ramais', exten: '_X.', priority: 2, app: 'Answer', appdata: null,
        })
        expect(data).toContainEqual({
            context: 'ramais', exten: '_X.', priority: 3, app: 'Playback', appdata: 'pbx-invalid',
        })
        expect(data).toContainEqual({
            context: 'ramais', exten: '_X.', priority: 4, app: 'HangUp', appdata: null,
        })
    })
})
