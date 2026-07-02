import { prisma } from '../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const DialplanRepository = {
    async create(tx: Tx, context: string, exten: string, number: string, type: 'sip' | 'pjsip') {
        await tx.extensions.createMany({
            data: [
                { context, exten, priority: 1, app: 'Set', appdata: 'MIXMONITOR_FILENAME=/var/spool/asterisk/monitor/${STRFTIME(${EPOCH},,${YEAR}-%m-%d)}_${CALLERID(num)}_${EXTEN}.wav' },
                { context, exten, priority: 2, app: 'MixMonitor', appdata: '${MIXMONITOR_FILENAME},b' },
                { context, exten, priority: 3, app: 'Dial', appdata: `${type.toUpperCase()}/${number},20` },
                { context, exten, priority: 4, app: 'HangUp', appdata: null },
            ],
        })
    },

    async delete(tx: Tx, context: string, exten: string) {
        await tx.extensions.deleteMany({ where: { context, exten } })
    },

    async recreate(tx: Tx, oldExten: string, oldContext: string, newContext: string, newExten: string, newNumber: string, type: 'sip' | 'pjsip') {
        await tx.extensions.deleteMany({ where: { context: oldContext, exten: oldExten } })
        await tx.extensions.createMany({
            data: [
                { context: newContext, exten: newExten, priority: 1, app: 'Set', appdata: 'MIXMONITOR_FILENAME=/var/spool/asterisk/monitor/${STRFTIME(${EPOCH},,${YEAR}-%m-%d)}_${CALLERID(num)}_${EXTEN}.wav' },
                { context: newContext, exten: newExten, priority: 2, app: 'MixMonitor', appdata: '${MIXMONITOR_FILENAME},b' },
                { context: newContext, exten: newExten, priority: 3, app: 'Dial', appdata: `${type.toUpperCase()}/${newNumber},20` },
                { context: newContext, exten: newExten, priority: 4, app: 'HangUp', appdata: null },
            ],
        })
    },

    async deleteManyByExten(tx: Tx, extens: string[]) {
        if (extens.length > 0)
            await tx.extensions.deleteMany({ where: { exten: { in: extens } } })
    },

    async ensureFallback(tx: Tx, context: string) {
        await tx.extensions.createMany({
            data: [
                { context, exten: '_X.', priority: 1, app: 'NoOp', appdata: 'Destino nao encontrado: ${EXTEN}' },
                { context, exten: '_X.', priority: 2, app: 'Congestion', appdata: null },
            ],
            skipDuplicates: true,
        })
    },
}
