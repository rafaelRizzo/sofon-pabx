import { prisma } from '../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type ExtensionCreateOpts = {
    password: string
    name: string
    context: string
    extras: Record<string, any>
}

type TrunkCreateOpts = {
    username: string
    password: string
    context: string
    codecs: string
    registrationMode: string
    host?: string
    setvar?: string
    accountcode: string
}

type TrunkUpdateOpts = {
    username?: string
    password?: string
    host?: string
    context?: string
    codecs?: string
    registrationMode: string
    existingHost?: string | null
    existingUsername?: string | null
}

export const PjsipRepository = {
    async createExtension(tx: Tx, id: string, opts: ExtensionCreateOpts) {
        const aorData: Record<string, any> = { id }
        const endpointData: Record<string, any> = {
            id,
            aors: id,
            auth: id,
            context: opts.context,
            callerid: `${opts.name} <${id}>`,
        }

        for (const [key, value] of Object.entries(opts.extras)) {
            if (value === undefined) continue
            if (key.startsWith('aor_')) aorData[key.slice(4)] = value
            else endpointData[key] = value
        }

        await tx.ps_aors.create({ data: aorData as any })
        await tx.ps_auths.create({ data: { id, auth_type: 'userpass', username: id, password: opts.password } })
        await tx.ps_endpoints.create({ data: endpointData as any })
    },

    async createTrunk(tx: Tx, id: string, opts: TrunkCreateOpts) {
        await tx.ps_auths.create({
            data: { id, auth_type: 'userpass', username: opts.username, password: opts.password },
        })

        if (opts.registrationMode === 'outbound') {
            await tx.ps_aors.create({
                data: { id, contact: `sip:${opts.host}`, qualify_frequency: 0 },
            })
            await tx.ps_endpoints.create({
                data: {
                    id,
                    aors: id,
                    outbound_auth: id,
                    context: opts.context,
                    from_user: opts.username,
                    from_domain: opts.host,
                    disallow: 'all',
                    allow: opts.codecs,
                    setvar: opts.setvar,
                    accountcode: opts.accountcode,
                } as any,
            })
            await tx.ps_registrations.create({
                data: {
                    id,
                    server_uri: `sip:${opts.host}`,
                    client_uri: `sip:${opts.username}@${opts.host}`,
                    contact_user: opts.username,
                    outbound_auth: id,
                    expiration: 3600,
                    retry_interval: 60,
                    max_retries: 10,
                },
            })
            await tx.ps_identifies.create({
                data: { id, endpoint: id, match: opts.host },
            })
        } else {
            await tx.ps_aors.create({ data: { id, max_contacts: 5, remove_existing: false } })
            await tx.ps_endpoints.create({
                data: {
                    id, aors: id, auth: id, context: opts.context,
                    disallow: 'all', allow: opts.codecs, setvar: opts.setvar,
                    accountcode: opts.accountcode,
                } as any,
            })
            if (opts.host) {
                await tx.ps_identifies.create({
                    data: { id, endpoint: id, match: opts.host },
                })
            }
        }
    },

    async renameExtension(tx: Tx, oldId: string, newId: string) {
        await tx.ps_auths.update({ where: { id: oldId }, data: { id: newId, username: newId } })
        await tx.ps_aors.update({ where: { id: oldId }, data: { id: newId } })
        await tx.ps_endpoints.update({
            where: { id: oldId },
            data: { id: newId, aors: newId, auth: newId },
        })
    },

    async updateExtension(tx: Tx, id: string, endpointUpdate: Record<string, any>, aorUpdate: Record<string, any>) {
        if (Object.keys(endpointUpdate).length > 0)
            await tx.ps_endpoints.update({ where: { id }, data: endpointUpdate as any })
        if (Object.keys(aorUpdate).length > 0)
            await tx.ps_aors.update({ where: { id }, data: aorUpdate as any })
    },

    async updateTrunk(tx: Tx, id: string, opts: TrunkUpdateOpts) {
        const authUpdate: Record<string, any> = {}
        if (opts.username !== undefined) authUpdate.username = opts.username
        if (opts.password !== undefined) authUpdate.password = opts.password
        if (Object.keys(authUpdate).length > 0)
            await tx.ps_auths.update({ where: { id }, data: authUpdate })

        const endpointUpdate: Record<string, any> = {}
        if (opts.context !== undefined) endpointUpdate.context = opts.context
        if (opts.codecs !== undefined) endpointUpdate.allow = opts.codecs
        if (opts.username !== undefined && opts.registrationMode === 'outbound') endpointUpdate.from_user = opts.username
        if (opts.host !== undefined && opts.registrationMode === 'outbound') endpointUpdate.from_domain = opts.host
        if (Object.keys(endpointUpdate).length > 0)
            await tx.ps_endpoints.update({ where: { id }, data: endpointUpdate })

        if (opts.host !== undefined) {
            await tx.ps_identifies.upsert({
                where: { id },
                create: { id, endpoint: id, match: opts.host },
                update: { match: opts.host },
            })
        }

        if (opts.registrationMode === 'outbound') {
            const aorUpdate: Record<string, any> = {}
            if (opts.host !== undefined) aorUpdate.contact = `sip:${opts.host}`
            if (Object.keys(aorUpdate).length > 0)
                await tx.ps_aors.update({ where: { id }, data: aorUpdate })

            const regUpdate: Record<string, any> = {}
            if (opts.host !== undefined) regUpdate.server_uri = `sip:${opts.host}`
            const newUsername = opts.username ?? opts.existingUsername
            const newHost = opts.host ?? opts.existingHost
            if (opts.host !== undefined || opts.username !== undefined)
                regUpdate.client_uri = `sip:${newUsername}@${newHost}`
            if (opts.username !== undefined) regUpdate.contact_user = opts.username
            if (Object.keys(regUpdate).length > 0)
                await tx.ps_registrations.update({ where: { id }, data: regUpdate })
        }
    },

    async deleteExtension(tx: Tx, id: string) {
        await tx.ps_endpoints.deleteMany({ where: { id } })
        await tx.ps_auths.deleteMany({ where: { id } })
        await tx.ps_aors.deleteMany({ where: { id } })
    },

    async deleteTrunk(tx: Tx, id: string, registrationMode: string) {
        if (registrationMode === 'outbound')
            await tx.ps_registrations.deleteMany({ where: { id } })
        await tx.ps_identifies.deleteMany({ where: { id } })
        await tx.ps_endpoints.deleteMany({ where: { id } })
        await tx.ps_auths.deleteMany({ where: { id } })
        await tx.ps_aors.deleteMany({ where: { id } })
    },

    async deleteManyByIds(tx: Tx, ids: string[], outboundIds: string[] = []) {
        if (outboundIds.length > 0)
            await tx.ps_registrations.deleteMany({ where: { id: { in: outboundIds } } })
        if (ids.length > 0) {
            await tx.ps_identifies.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_endpoints.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_auths.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_aors.deleteMany({ where: { id: { in: ids } } })
        }
    },
}
