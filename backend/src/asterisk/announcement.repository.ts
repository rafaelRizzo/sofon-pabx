import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { queueAppExten } from './queue.repository'
import {
    ANNOUNCEMENT_CONTEXT, announcementExten, TC_CONTEXT, tcEntry, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten,
} from './dialplan-names'

export { ANNOUNCEMENT_CONTEXT, announcementExten }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function resolveTarget(tx: Tx, dest: RouteDestination): Promise<string | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            const ext = await tx.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await tx.queue.findUnique({
                where: { id: dest.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${dest.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(dest.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(dest.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(dest.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(dest.id)},1`
    }
}

export const AnnouncementRepository = {
    // soundPath: caminho absoluto SEM extensão (Playback resolve o formato sozinho), ou null quando
    // não há áudio vinculado — nesse caso grava só o destino para evitar "invalid extension"
    async syncEntry(tx: Tx, id: string, soundPath: string | null, destination: RouteDestination) {
        const exten = announcementExten(id)
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten } })
        const target = await resolveTarget(tx, destination)
        const rows = soundPath
            ? [
                { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: 'Playback', appdata: soundPath },
                { context: ANNOUNCEMENT_CONTEXT, exten, priority: 2, app: target ? 'Goto' : 'Hangup', appdata: target },
              ]
            : [
                { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: target ? 'Goto' : 'Hangup', appdata: target },
              ]
        await tx.extensions.createMany({ data: rows })
    },

    async removeEntry(tx: Tx, id: string) {
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten: announcementExten(id) } })
    },

    async removeManyByIds(tx: Tx, ids: string[]) {
        if (ids.length === 0) return
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten: { in: ids.map(announcementExten) } } })
    },
}
