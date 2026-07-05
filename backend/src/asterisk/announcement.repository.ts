import { prisma } from '../lib/prisma'
import { ANNOUNCEMENT_CONTEXT, announcementExten } from './dialplan-names'

export { ANNOUNCEMENT_CONTEXT, announcementExten }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const AnnouncementRepository = {
    // soundPath: caminho absoluto SEM extensão (Playback resolve o formato sozinho)
    async syncEntry(tx: Tx, id: string, soundPath: string) {
        const exten = announcementExten(id)
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten } })
        await tx.extensions.createMany({
            data: [
                { context: ANNOUNCEMENT_CONTEXT, exten, priority: 1, app: 'Playback', appdata: soundPath },
                { context: ANNOUNCEMENT_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
            ],
        })
    },

    async removeEntry(tx: Tx, id: string) {
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten: announcementExten(id) } })
    },

    async removeManyByIds(tx: Tx, ids: string[]) {
        if (ids.length === 0) return
        await tx.extensions.deleteMany({ where: { context: ANNOUNCEMENT_CONTEXT, exten: { in: ids.map(announcementExten) } } })
    },
}
