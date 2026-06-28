import { prisma } from '../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const DialplanRepository = {
    async create(tx: Tx, context: string, exten: string, type: 'sip' | 'pjsip') {
        await tx.extensions.createMany({
            data: [
                { context, exten, priority: 1, app: 'Dial', appdata: `${type.toUpperCase()}/${exten},20` },
                { context, exten, priority: 2, app: 'HangUp', appdata: null },
            ],
        })
    },

    async delete(tx: Tx, context: string, exten: string) {
        await tx.extensions.deleteMany({ where: { context, exten } })
    },

    async recreate(tx: Tx, oldContext: string, oldExten: string, newContext: string, newExten: string, type: 'sip' | 'pjsip') {
        await tx.extensions.deleteMany({ where: { context: oldContext, exten: oldExten } })
        await tx.extensions.createMany({
            data: [
                { context: newContext, exten: newExten, priority: 1, app: 'Dial', appdata: `${type.toUpperCase()}/${newExten},20` },
                { context: newContext, exten: newExten, priority: 2, app: 'HangUp', appdata: null },
            ],
        })
    },

    async deleteManyByExten(tx: Tx, extens: string[]) {
        if (extens.length > 0)
            await tx.extensions.deleteMany({ where: { exten: { in: extens } } })
    },
}
