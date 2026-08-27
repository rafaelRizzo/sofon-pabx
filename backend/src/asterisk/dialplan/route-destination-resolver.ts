import { prisma } from '../../lib/prisma'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { QUEUE_APP_CONTEXT, queueAppExten } from '../destinations/queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
    VAR_CONTEXT, varEntry, VARCOND_CONTEXT, varCondEntry, FLOW_CONTEXT, flowExten,
    IXC_NODE_CONTEXT, ixcNodeExten,
} from './dialplan-names'

export type DialplanTarget = { context: string; exten: string; priority: number }

// Única implementação do switch RouteDestination → context/exten/priority Asterisk - usada pelo AGI
// server (src/asterisk/agi-server.ts) pra decidir onSuccess/onError de RequestTemplate em tempo de
// execução, e por todo repositório que materializa dialplan estático (announcement/ivr/timecondition/
// holidaygroup/variable/variablecondition/queue/inboundroute), formatando o resultado pro shape local
// que cada um precisa (string "ctx,exten,prio" ou {app,appdata}). Não duplicar esse switch de novo.
// 'request' encadeia outro template normalmente (mesmo Goto estático de sempre) - loop entre
// templates é erro de configuração do usuário, mesma situação já possível com timecondition.
export async function resolveRouteDestinationToDialplan(dest: RouteDestination): Promise<DialplanTarget | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            // exten é o alias puro (ex: "2002"), não o `number` completo (ex: "2002_a9e2463c8f") -
            // o dialplan genérico de ramal (DialplanRepository.ensureGenericRoutingPattern) só casa
            // padrões de alias puro (2-6 dígitos); usar `number` aqui nunca bateria com nenhuma
            // exten real, caindo sempre no fallback (Congestion)
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { context: true, alias: true } })
            return ext ? { context: ext.context, exten: ext.alias, priority: 1 } : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: dest.id }, select: { number: true, company: { select: { asteriskId: true } } } })
            return q?.number ? { context: QUEUE_APP_CONTEXT, exten: queueAppExten(q.company.asteriskId, q.number), priority: 1 } : null
        }
        case 'voicemail':
            return { context: 'vm', exten: dest.id, priority: 1 }
        case 'timecondition':
            return { context: TC_CONTEXT, exten: tcEntry(dest.id), priority: 1 }
        case 'holiday':
            return { context: HOL_CONTEXT, exten: holEntry(dest.id), priority: 1 }
        case 'announcement':
            return { context: ANNOUNCEMENT_CONTEXT, exten: announcementExten(dest.id), priority: 1 }
        case 'ivr':
            return { context: IVR_CONTEXT, exten: ivrExten(dest.id), priority: 1 }
        case 'request':
            return { context: REQUEST_TEMPLATE_CONTEXT, exten: requestTemplateExten(dest.id), priority: 1 }
        case 'ixc':
            return { context: IXC_NODE_CONTEXT, exten: ixcNodeExten(dest.id), priority: 1 }
        case 'variable-set':
            return { context: VAR_CONTEXT, exten: varEntry(dest.id), priority: 1 }
        case 'variable-condition':
            return { context: VARCOND_CONTEXT, exten: varCondEntry(dest.id), priority: 1 }
        case 'flow':
            return { context: FLOW_CONTEXT, exten: flowExten(dest.id), priority: 1 }
    }
}
