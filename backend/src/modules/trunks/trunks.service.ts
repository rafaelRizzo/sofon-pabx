import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import type { CreateTrunkInput, UpdateTrunkInput } from './schemas/trunk.schema'
import { AppError } from '../../utils/errors/app.error'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const bytes = randomBytes(20)
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

const toAsteriskId = (asteriskId: string, name: string) => `${asteriskId}-trunk-${name}`

const trunkSelect = {
    id: true,
    name: true,
    companyId: true,
    type: true,
    registrationMode: true,
    host: true,
    username: true,
    context: true,
    codecs: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getTrunks = async (companyId: string) => {
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new AppError('Company not found', 404)

    return prisma.trunk.findMany({ where: { companyId }, select: trunkSelect })
}

export const getTrunkById = async (id: string) => {
    const trunk = await prisma.trunk.findUnique({ where: { id }, select: trunkSelect })
    if (!trunk) throw new AppError('Trunk not found', 404)
    return trunk
}

export const createTrunk = async (data: CreateTrunkInput) => {
    const company = await prisma.company.findUnique({ where: { id: data.companyId }, select: { asteriskId: true } })
    if (!company) throw new AppError('Company not found', 404)

    const existing = await prisma.trunk.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Trunk already exists for this company', 409)

    const astId = toAsteriskId(company.asteriskId, data.name)
    const password = data.password ?? generatePassword()
    const username = data.username ?? astId

    if (data.type === 'pjsip') {
        await prisma.$transaction(async (tx) => {
            await tx.ps_auths.create({
                data: { id: astId, auth_type: 'userpass', username, password },
            })

            if (data.registrationMode === 'outbound') {
                await tx.ps_aors.create({
                    data: { id: astId, contact: `sip:${data.host}`, qualify_frequency: 0 },
                })
                await tx.ps_endpoints.create({
                    data: {
                        id: astId,
                        aors: astId,
                        outbound_auth: astId,
                        context: data.context,
                        from_user: username,
                        from_domain: data.host,
                        disallow: 'all',
                        allow: data.codecs,
                    },
                })
                await tx.ps_registrations.create({
                    data: {
                        id: astId,
                        server_uri: `sip:${data.host}`,
                        client_uri: `sip:${username}@${data.host}`,
                        contact_user: username,
                        outbound_auth: astId,
                        expiration: 3600,
                        retry_interval: 60,
                        max_retries: 10,
                    },
                })
            } else {
                await tx.ps_aors.create({
                    data: { id: astId, max_contacts: 5, remove_existing: false },
                })
                await tx.ps_endpoints.create({
                    data: {
                        id: astId,
                        aors: astId,
                        auth: astId,
                        context: data.context,
                        disallow: 'all',
                        allow: data.codecs,
                    },
                })
            }

            await tx.trunk.create({
                data: {
                    name: data.name,
                    companyId: data.companyId,
                    type: data.type,
                    registrationMode: data.registrationMode,
                    host: data.registrationMode === 'outbound' ? data.host : (data.host ?? null),
                    username,
                    password,
                    context: data.context,
                    codecs: data.codecs,
                },
            })
        })
    } else {
        await prisma.$transaction(async (tx) => {
            await tx.sip_peers.create({
                data: {
                    name: astId,
                    host: data.registrationMode === 'outbound' ? data.host! : 'dynamic',
                    secret: password,
                    defaultuser: username,
                    fromuser: username,
                    type: data.registrationMode === 'outbound' ? 'peer' : 'friend',
                    context: data.context,
                    disallow: 'all',
                    allow: data.codecs,
                    qualify: 'yes',
                    insecure: 'port,invite',
                    nat: 'force_rport,comedia',
                },
            })

            await tx.trunk.create({
                data: {
                    name: data.name,
                    companyId: data.companyId,
                    type: data.type,
                    registrationMode: data.registrationMode,
                    host: data.registrationMode === 'outbound' ? data.host : (data.host ?? null),
                    username,
                    password,
                    context: data.context,
                    codecs: data.codecs,
                },
            })
        })
    }

    const created = await prisma.trunk.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
        select: trunkSelect,
    })
    return created!
}

export const updateTrunk = async (id: string, data: UpdateTrunkInput) => {
    const existing = await prisma.trunk.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Trunk not found', 404)

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)
    const { type, registrationMode } = existing

    await prisma.$transaction(async (tx) => {
        if (type === 'pjsip') {
            const authUpdate: Record<string, any> = {}
            if (data.username !== undefined) authUpdate.username = data.username
            if (data.password !== undefined) authUpdate.password = data.password
            if (Object.keys(authUpdate).length > 0) {
                await tx.ps_auths.update({ where: { id: astId }, data: authUpdate })
            }

            const endpointUpdate: Record<string, any> = {}
            if (data.context !== undefined) endpointUpdate.context = data.context
            if (data.codecs !== undefined) endpointUpdate.allow = data.codecs
            if (data.username !== undefined && registrationMode === 'outbound') endpointUpdate.from_user = data.username
            if (data.host !== undefined && registrationMode === 'outbound') endpointUpdate.from_domain = data.host
            if (Object.keys(endpointUpdate).length > 0) {
                await tx.ps_endpoints.update({ where: { id: astId }, data: endpointUpdate })
            }

            if (registrationMode === 'outbound') {
                const aorUpdate: Record<string, any> = {}
                if (data.host !== undefined) aorUpdate.contact = `sip:${data.host}`
                if (Object.keys(aorUpdate).length > 0) {
                    await tx.ps_aors.update({ where: { id: astId }, data: aorUpdate })
                }

                const regUpdate: Record<string, any> = {}
                if (data.host !== undefined) regUpdate.server_uri = `sip:${data.host}`
                const newUsername = data.username ?? existing.username
                const newHost = data.host ?? existing.host
                if (data.host !== undefined || data.username !== undefined) {
                    regUpdate.client_uri = `sip:${newUsername}@${newHost}`
                }
                if (data.username !== undefined) regUpdate.contact_user = data.username
                if (Object.keys(regUpdate).length > 0) {
                    await tx.ps_registrations.update({ where: { id: astId }, data: regUpdate })
                }
            }
        } else {
            const sipUpdate: Record<string, any> = {}
            if (data.host !== undefined && registrationMode === 'outbound') sipUpdate.host = data.host
            if (data.username !== undefined) { sipUpdate.defaultuser = data.username; sipUpdate.fromuser = data.username }
            if (data.password !== undefined) sipUpdate.secret = data.password
            if (data.context !== undefined) sipUpdate.context = data.context
            if (data.codecs !== undefined) sipUpdate.allow = data.codecs
            if (Object.keys(sipUpdate).length > 0) {
                await tx.sip_peers.update({ where: { name: astId }, data: sipUpdate })
            }
        }

        await tx.trunk.update({ where: { id }, data })
    })

    return prisma.trunk.findUnique({ where: { id }, select: trunkSelect })
}

export const deleteTrunk = async (id: string) => {
    const existing = await prisma.trunk.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Trunk not found', 404)

    const astId = toAsteriskId(existing.company.asteriskId, existing.name)

    await prisma.$transaction(async (tx) => {
        if (existing.type === 'pjsip') {
            await tx.ps_registrations.deleteMany({ where: { id: astId } })
            await tx.ps_endpoints.deleteMany({ where: { id: astId } })
            await tx.ps_auths.deleteMany({ where: { id: astId } })
            await tx.ps_aors.deleteMany({ where: { id: astId } })
        } else {
            await tx.sip_peers.deleteMany({ where: { name: astId } })
        }

        await tx.trunk.delete({ where: { id } })
    })
}
