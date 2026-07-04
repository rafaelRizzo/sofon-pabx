import { prisma } from '../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// contexto único compartilhado por todos os announcements — mesmo padrão de queues-app/
// timeconditions: contexto dinâmico por entidade não é resolvido pelo Asterisk nesse setup
// (switch => Realtime só funciona em contextos declarados estaticamente em extensions.conf)
export const ANNOUNCEMENT_CONTEXT = 'announcements'
export const announcementExten = (id: string) => `ann-${id}`

// Reaproveita o dir de sons padrão do Asterisk (astdatadir/sounds), isolado por empresa —
// mesmo padrão de /var/spool/asterisk/monitor/<asteriskId>/ usado nas gravações
export const SOUNDS_BASE_DIR = '/var/lib/asterisk/sounds'
export const announcementSoundDir = (asteriskId: string) => `${SOUNDS_BASE_DIR}/${asteriskId}`
// sem extensão — appdata do Playback (Asterisk resolve o formato sozinho)
export const announcementSoundPath = (asteriskId: string, id: string) => `${announcementSoundDir(asteriskId)}/${id}`

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
