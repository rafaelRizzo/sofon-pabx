import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { audioSoundPath } from './audio.repository'
import { ANNOUNCEMENT_CONTEXT, announcementExten } from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'
import { FlowEdgeRepository } from './flow-edge.repository'
import { nodeExitCheck } from './flow-node-runtime'

export { ANNOUNCEMENT_CONTEXT, announcementExten }

async function resolveTarget(dest: RouteDestination): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

// soundPath: caminho absoluto SEM extensão (Playback resolve o formato sozinho), ou null quando não
// há áudio vinculado — nesse caso grava só o destino para evitar "invalid extension"
function buildDialplan(id: string, soundPath: string | null, target: string | null): DialplanRow[] {
    const exten = announcementExten(id)
    return soundPath
        ? [
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: 'Playback', appdata: soundPath },
            nodeExitCheck(ANNOUNCEMENT_CONTEXT, exten, 2, 'default'),
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 3, app: target ? 'Goto' : 'Hangup', appdata: target },
          ]
        : [
            nodeExitCheck(ANNOUNCEMENT_CONTEXT, exten, 1, 'default'),
            { context: ANNOUNCEMENT_CONTEXT, exten, priority: 2, app: target ? 'Goto' : 'Hangup', appdata: target },
          ]
}

export const AnnouncementRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de Announcement.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${ANNOUNCEMENT_CONTEXT}:${asteriskId}`, async () => {
            const [announcements, edges] = await Promise.all([
                prisma.announcement.findMany({ where: { companyId } }),
                FlowEdgeRepository.getBySource(companyId, 'announcement'),
            ])
            const entries: DialplanRow[] = []
            for (const a of announcements) {
                const soundPath = a.audioId ? audioSoundPath(asteriskId, a.audioId) : null
                const target = await resolveTarget(edges.get(a.id)?.default ?? null)
                entries.push(...buildDialplan(a.id, soundPath, target))
            }
            await writeContextFile(ANNOUNCEMENT_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
