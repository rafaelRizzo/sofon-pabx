import { prisma } from '../lib/prisma'
import type { InboundDest } from '../modules/inbound-routes/schemas/inbound-route.schema'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function resolveDestination(tx: Tx, dest: InboundDest): Promise<{ app: string; appdata: string | null }> {
    if (!dest || dest.type === 'hangup') return { app: 'Hangup', appdata: null }

    switch (dest.type) {
        case 'extension': {
            const ext = await tx.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? { app: 'Goto', appdata: `${ext.context},${ext.number},1` } : { app: 'Hangup', appdata: null }
        }
        case 'queue': {
            const q = await tx.queue.findUnique({ where: { id: dest.id }, select: { number: true } })
            return q?.number ? { app: 'Goto', appdata: `queues-app,${q.number},1` } : { app: 'Hangup', appdata: null }
        }
        case 'voicemail':
            return { app: 'Goto', appdata: `vm,${dest.id},1` }
        case 'timecondition':
            return { app: 'Goto', appdata: `tc-${dest.id},s,1` }
    }
}

// context per-trunk garante que 2 trunks diferentes recebam o mesmo DID sem conflito
function trunkContext(trunkId: string) {
    return `from-trunk-${trunkId}`
}

export const InboundRouteRepository = {
    async create(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest) {
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.create({
            data: { context: trunkContext(trunkId), exten: didNumber, priority: 1, app, appdata },
        })
    },

    async update(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest) {
        const context = trunkContext(trunkId)
        await tx.extensions.deleteMany({ where: { context, exten: didNumber } })
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.create({ data: { context, exten: didNumber, priority: 1, app, appdata } })
    },

    async delete(tx: Tx, trunkId: string, didNumber: string) {
        await tx.extensions.deleteMany({ where: { context: trunkContext(trunkId), exten: didNumber } })
    },
}
