import { prisma } from '../../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const SipRepository = {
    async createExtension(tx: Tx, name: string, password: string, context: string, extras: Record<string, any>) {
        await tx.sip_peers.create({
            data: { name, secret: password, context, ...extras } as any,
        })
    },

    async createTrunk(tx: Tx, name: string, opts: { host?: string, username: string, password: string, context: string, codecs: string, registrationMode: string }) {
        await tx.sip_peers.create({
            data: {
                name,
                host: opts.registrationMode === 'outbound' ? opts.host! : 'dynamic',
                secret: opts.password,
                defaultuser: opts.username,
                fromuser: opts.username,
                type: opts.registrationMode === 'outbound' ? 'peer' : 'friend',
                context: opts.context,
                disallow: 'all',
                allow: opts.codecs,
                qualify: 'yes',
                insecure: 'port,invite',
                nat: 'force_rport,comedia',
            } as any,
        })
    },

    async renameExtension(tx: Tx, oldName: string, newName: string) {
        await tx.sip_peers.update({ where: { name: oldName }, data: { name: newName } })
    },

    async updateExtension(tx: Tx, name: string, data: Record<string, any>) {
        if (Object.keys(data).length > 0)
            await tx.sip_peers.update({ where: { name }, data: data as any })
    },

    async updateTrunk(tx: Tx, name: string, opts: { host?: string, username?: string, password?: string, context?: string, codecs?: string, registrationMode: string }) {
        const update: Record<string, any> = {}
        if (opts.host !== undefined && opts.registrationMode === 'outbound') update.host = opts.host
        if (opts.username !== undefined) { update.defaultuser = opts.username; update.fromuser = opts.username }
        if (opts.password !== undefined) update.secret = opts.password
        if (opts.context !== undefined) update.context = opts.context
        if (opts.codecs !== undefined) update.allow = opts.codecs
        if (Object.keys(update).length > 0)
            await tx.sip_peers.update({ where: { name }, data: update as any })
    },

    async deleteExtension(tx: Tx, name: string) {
        await tx.sip_peers.delete({ where: { name } })
    },

    async deleteTrunk(tx: Tx, name: string) {
        await tx.sip_peers.delete({ where: { name } })
    },

    async deleteManyByNames(tx: Tx, names: string[]) {
        if (names.length > 0)
            await tx.sip_peers.deleteMany({ where: { name: { in: names } } })
    },
}
