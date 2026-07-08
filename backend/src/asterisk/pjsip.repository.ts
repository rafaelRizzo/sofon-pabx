import { prisma } from '../lib/prisma'
import { AppError } from '../utils/errors/app.error'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const isDynamicHost = (host?: string) => !host || host.toLowerCase() === 'dynamic'

const isUniqueConstraintError = (err: unknown): boolean => (err as { code?: string })?.code === 'P2002'

const hostUri = (host?: string | null, port?: number | null) => (port ? `${host}:${port}` : host)

type ExtensionCreateOpts = {
    password: string
    name: string
    context: string
    extras: Record<string, any>
}

type TrunkCreateOpts = {
    username?: string
    password?: string
    context: string
    codecs: string
    registrationMode: string
    identifyBy?: 'ip' | 'username' | null
    host?: string
    port?: number | null
    setvar?: string
    accountcode: string
}

type TrunkUpdateOpts = {
    username?: string | null
    password?: string | null
    host?: string
    port?: number | null
    context?: string
    codecs?: string
    registrationMode: string
    identifyBy?: 'ip' | 'username' | null
    existingIdentifyBy?: 'ip' | 'username' | null
    existingHost?: string | null
    existingPort?: number | null
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
        const hasAuth = opts.registrationMode === 'outbound' || opts.identifyBy === 'username'
        if (hasAuth) {
            await tx.ps_auths.create({
                data: { id, auth_type: 'userpass', username: opts.username!, password: opts.password! },
            })
        }

        if (opts.registrationMode === 'outbound') {
            const uri = hostUri(opts.host, opts.port)
            await tx.ps_aors.create({
                data: { id, contact: `sip:${uri}`, qualify_frequency: 60 },
            })
            await tx.ps_endpoints.create({
                data: {
                    id,
                    aors: id,
                    outbound_auth: id,
                    context: opts.context,
                    from_user: opts.username,
                    from_domain: uri,
                    disallow: 'all',
                    allow: opts.codecs,
                    setvar: opts.setvar,
                    accountcode: opts.accountcode,
                    direct_media: false,
                    force_rport: true,
                    rtp_symmetric: true,
                    rewrite_contact: true,
                } as any,
            })
            await tx.ps_registrations.create({
                data: {
                    id,
                    server_uri: `sip:${uri}`,
                    client_uri: `sip:${opts.username}@${uri}`,
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
            const endpointId = opts.identifyBy === 'username' ? opts.username! : id
            try {
                await tx.ps_aors.create({ data: { id: endpointId, max_contacts: 5, remove_existing: false } })
                await tx.ps_endpoints.create({
                    data: {
                        id: endpointId, aors: endpointId, ...(hasAuth ? { auth: id } : {}), context: opts.context,
                        disallow: 'all', allow: opts.codecs, setvar: opts.setvar,
                        accountcode: opts.accountcode,
                        direct_media: false,
                        force_rport: true,
                        rtp_symmetric: true,
                        rewrite_contact: true,
                    } as any,
                })
            } catch (err) {
                if (isUniqueConstraintError(err))
                    throw new AppError('Username já utilizado por outra trunk', 409)
                throw err
            }
            if (!isDynamicHost(opts.host)) {
                await tx.ps_identifies.create({
                    data: { id, endpoint: endpointId, match: opts.host },
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
        const wasUsernameIdentity = opts.registrationMode === 'inbound' && opts.existingIdentifyBy === 'username'
        const isUsernameIdentity = opts.registrationMode === 'inbound' && opts.identifyBy === 'username'
        const hadAuth = opts.registrationMode === 'outbound' || wasUsernameIdentity
        const hasAuth = opts.registrationMode === 'outbound' || isUsernameIdentity

        const oldEndpointId = wasUsernameIdentity ? opts.existingUsername! : id
        const newEndpointId = isUsernameIdentity ? (opts.username ?? opts.existingUsername!) : id

        if (!hadAuth && hasAuth) {
            await tx.ps_auths.create({
                data: { id, auth_type: 'userpass', username: opts.username!, password: opts.password! },
            })
        } else if (hadAuth && !hasAuth) {
            await tx.ps_auths.deleteMany({ where: { id } })
        } else if (hadAuth && hasAuth) {
            const authUpdate: Record<string, any> = {}
            if (opts.username !== undefined && opts.username !== null) authUpdate.username = opts.username
            if (opts.password !== undefined && opts.password !== null) authUpdate.password = opts.password
            if (Object.keys(authUpdate).length > 0)
                await tx.ps_auths.update({ where: { id }, data: authUpdate })
        }

        const hostChanged = opts.host !== undefined || opts.port !== undefined
        const newHost = opts.host ?? opts.existingHost
        const newPort = opts.port !== undefined ? opts.port : opts.existingPort

        const endpointUpdate: Record<string, any> = {}
        if (opts.context !== undefined) endpointUpdate.context = opts.context
        if (opts.codecs !== undefined) endpointUpdate.allow = opts.codecs
        if (opts.username !== undefined && opts.registrationMode === 'outbound') endpointUpdate.from_user = opts.username
        if (hostChanged && opts.registrationMode === 'outbound') endpointUpdate.from_domain = hostUri(newHost, newPort)
        if (newEndpointId !== oldEndpointId) {
            endpointUpdate.id = newEndpointId
            endpointUpdate.aors = newEndpointId
        }
        if (hadAuth !== hasAuth) endpointUpdate.auth = hasAuth ? id : null
        if (Object.keys(endpointUpdate).length > 0) {
            try {
                await tx.ps_endpoints.update({ where: { id: oldEndpointId }, data: endpointUpdate })
                if (newEndpointId !== oldEndpointId)
                    await tx.ps_aors.update({ where: { id: oldEndpointId }, data: { id: newEndpointId } })
            } catch (err) {
                if (isUniqueConstraintError(err))
                    throw new AppError('Username já utilizado por outra trunk', 409)
                throw err
            }
        }

        if (opts.host !== undefined) {
            if (isDynamicHost(opts.host)) {
                await tx.ps_identifies.deleteMany({ where: { id } })
            } else {
                await tx.ps_identifies.upsert({
                    where: { id },
                    create: { id, endpoint: newEndpointId, match: opts.host },
                    update: { match: opts.host, endpoint: newEndpointId },
                })
            }
        } else if (newEndpointId !== oldEndpointId) {
            await tx.ps_identifies.updateMany({ where: { id }, data: { endpoint: newEndpointId } })
        }

        if (opts.registrationMode === 'outbound') {
            const aorUpdate: Record<string, any> = {}
            if (hostChanged) aorUpdate.contact = `sip:${hostUri(newHost, newPort)}`
            if (Object.keys(aorUpdate).length > 0)
                await tx.ps_aors.update({ where: { id }, data: aorUpdate })

            const regUpdate: Record<string, any> = {}
            if (hostChanged) regUpdate.server_uri = `sip:${hostUri(newHost, newPort)}`
            const newUsername = opts.username ?? opts.existingUsername
            if (hostChanged || opts.username !== undefined)
                regUpdate.client_uri = `sip:${newUsername}@${hostUri(newHost, newPort)}`
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

    async deleteTrunk(tx: Tx, id: string, registrationMode: string, endpointId: string = id) {
        if (registrationMode === 'outbound')
            await tx.ps_registrations.deleteMany({ where: { id } })
        await tx.ps_identifies.deleteMany({ where: { id } })
        await tx.ps_endpoints.deleteMany({ where: { id: endpointId } })
        await tx.ps_auths.deleteMany({ where: { id } })
        await tx.ps_aors.deleteMany({ where: { id: endpointId } })
    },

    async deleteManyByIds(tx: Tx, ids: string[], outboundIds: string[] = [], usernameEndpointIds: string[] = []) {
        if (outboundIds.length > 0)
            await tx.ps_registrations.deleteMany({ where: { id: { in: outboundIds } } })
        if (ids.length > 0) {
            await tx.ps_identifies.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_endpoints.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_auths.deleteMany({ where: { id: { in: ids } } })
            await tx.ps_aors.deleteMany({ where: { id: { in: ids } } })
        }
        if (usernameEndpointIds.length > 0) {
            await tx.ps_endpoints.deleteMany({ where: { id: { in: usernameEndpointIds } } })
            await tx.ps_aors.deleteMany({ where: { id: { in: usernameEndpointIds } } })
        }
    },
}
