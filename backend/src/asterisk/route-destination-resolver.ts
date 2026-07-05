import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { QUEUE_APP_CONTEXT, queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten,
} from './dialplan-names'

export type DialplanTarget = { context: string; exten: string; priority: number }

// Resolve um RouteDestination pro context/exten/priority Asterisk equivalente via EXEC Goto — usado
// só pelo AGI server (src/asterisk/agi-server.ts) pra decidir onSuccess/onError de RequestTemplate em
// tempo de execução. 'request' encadeia outro template normalmente (mesmo Goto estático de sempre) —
// loop entre templates é erro de configuração do usuário, mesma situação já possível com timecondition.
export async function resolveRouteDestinationToDialplan(dest: RouteDestination): Promise<DialplanTarget | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? { context: ext.context, exten: ext.number, priority: 1 } : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: dest.id }, select: { number: true, company: { select: { asteriskId: true } } } })
            return q?.number ? { context: QUEUE_APP_CONTEXT, exten: queueAppExten(q.company.asteriskId, q.number), priority: 1 } : null
        }
        case 'voicemail':
            return { context: 'vm', exten: dest.id, priority: 1 }
        case 'timecondition':
            return { context: TC_CONTEXT, exten: tcEntry(dest.id), priority: 1 }
        case 'announcement':
            return { context: ANNOUNCEMENT_CONTEXT, exten: announcementExten(dest.id), priority: 1 }
        case 'ivr':
            return { context: IVR_CONTEXT, exten: ivrExten(dest.id), priority: 1 }
        case 'request':
            return { context: REQUEST_TEMPLATE_CONTEXT, exten: requestTemplateExten(dest.id), priority: 1 }
    }
}
