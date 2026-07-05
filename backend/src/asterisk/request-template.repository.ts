import { prisma } from '../lib/prisma'
import { REQUEST_TEMPLATE_CONTEXT, requestTemplateExten } from './dialplan-names'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Dialplan de um RequestTemplate é sempre o mesmo par fixo (AGI + Hangup) — quem varia é o registro
// no banco, lido pelo AGI server em tempo de chamada via o id no agiUrl. Por isso só precisa ser
// (re)gravado no create/delete, nunca no update de method/url/headers/etc (ver RequestTemplatesService).
export const RequestTemplateRepository = {
    async syncEntry(tx: Tx, id: string, agiUrl: string) {
        const exten = requestTemplateExten(id)
        await tx.extensions.deleteMany({ where: { context: REQUEST_TEMPLATE_CONTEXT, exten } })
        await tx.extensions.createMany({
            data: [
                { context: REQUEST_TEMPLATE_CONTEXT, exten, priority: 1, app: 'AGI', appdata: agiUrl },
                { context: REQUEST_TEMPLATE_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
            ],
        })
    },

    async removeEntry(tx: Tx, id: string) {
        await tx.extensions.deleteMany({ where: { context: REQUEST_TEMPLATE_CONTEXT, exten: requestTemplateExten(id) } })
    },

    async removeManyByIds(tx: Tx, ids: string[]) {
        if (ids.length === 0) return
        await tx.extensions.deleteMany({ where: { context: REQUEST_TEMPLATE_CONTEXT, exten: { in: ids.map(requestTemplateExten) } } })
    },
}
