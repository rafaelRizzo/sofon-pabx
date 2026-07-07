import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { queueAppExten } from './queue.repository'
import { audioSoundPath } from './audio.repository'
import {
    ANNOUNCEMENT_CONTEXT, announcementExten, TC_CONTEXT, tcEntry, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

export { ANNOUNCEMENT_CONTEXT, announcementExten }

async function resolveTarget(dest: RouteDestination): Promise<string | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({
                where: { id: dest.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${dest.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(dest.id)},1`
        case 'holiday':
            return `${HOL_CONTEXT},${holEntry(dest.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(dest.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(dest.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(dest.id)},1`
    }
}

// soundPath: caminho absoluto SEM extensão (Playback resolve o formato sozinho), ou null quando não
// há áudio vinculado — nesse caso grava só o destino para evitar "invalid extension"
function buildDialplan(id: string, soundPath: string | null, target: string | null): DialplanRow[] {
    const exten = announcementExten(id)
    return soundPath
        ? [
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: 'Playback', appdata: soundPath },
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 2, app: target ? 'Goto' : 'Hangup', appdata: target },
          ]
        : [
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: target ? 'Goto' : 'Hangup', appdata: target },
          ]
}

export const AnnouncementRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de Announcement.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${ANNOUNCEMENT_CONTEXT}:${asteriskId}`, async () => {
            const announcements = await prisma.announcement.findMany({ where: { companyId } })
            const entries: DialplanRow[] = []
            for (const a of announcements) {
                const soundPath = a.audioId ? audioSoundPath(asteriskId, a.audioId) : null
                const target = await resolveTarget(a.destination as RouteDestination)
                entries.push(...buildDialplan(a.id, soundPath, target))
            }
            await writeContextFile(ANNOUNCEMENT_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
