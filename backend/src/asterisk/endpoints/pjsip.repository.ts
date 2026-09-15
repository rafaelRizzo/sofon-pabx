import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import { logger } from '../../utils/logger'
import { runAmiCommand } from '../transport/ami-client'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const isDynamicHost = (host?: string | null) => !host || host.toLowerCase() === 'dynamic'

const isUniqueConstraintError = (err: unknown): boolean => (err as { code?: string })?.code === 'P2002'

const hostUri = (host?: string | null, port?: number | null) => (port ? `${host}:${port}` : host)

type ExtensionCreateOpts = {
    password: string
    name: string
    context: string
    extras: Record<string, any>
}

type TrunkAdvancedOpts = {
    transport?: string | null
    dtmfMode?: string | null
    directMedia?: boolean | null
    qualifyFrequency?: number | null
    qualifyTimeout?: number | null
    outboundProxy?: string | null
    iceSupport?: boolean | null
    rel?: string | null
    timers?: string | null
    timersMinSe?: number | null
    timersSessExpires?: number | null
    sendDiversion?: boolean | null
}

type TrunkCreateOpts = TrunkAdvancedOpts & {
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

type TrunkUpdateOpts = TrunkAdvancedOpts & {
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

const endpointExtrasOf = (opts: TrunkAdvancedOpts) => {
    const extras: Record<string, any> = {}
    if (opts.transport !== undefined) extras.transport = opts.transport
    if (opts.dtmfMode !== undefined) extras.dtmf_mode = opts.dtmfMode
    if (opts.directMedia !== undefined) extras.direct_media = opts.directMedia
    if (opts.outboundProxy !== undefined) extras.outbound_proxy = opts.outboundProxy
    if (opts.iceSupport !== undefined) extras.ice_support = opts.iceSupport
    if (opts.rel !== undefined) extras.rel = opts.rel
    if (opts.timers !== undefined) extras.timers = opts.timers
    if (opts.timersMinSe !== undefined) extras.timers_min_se = opts.timersMinSe
    if (opts.timersSessExpires !== undefined) extras.timers_sess_expires = opts.timersSessExpires
    if (opts.sendDiversion !== undefined) extras.send_diversion = opts.sendDiversion
    return extras
}

const aorExtrasOf = (opts: TrunkAdvancedOpts) => {
    const extras: Record<string, any> = {}
    if (opts.qualifyFrequency !== undefined) extras.qualify_frequency = opts.qualifyFrequency
    if (opts.qualifyTimeout !== undefined) extras.qualify_timeout = opts.qualifyTimeout
    return extras
}

// ps_registrations só é lido pelo módulo na carga/reload - diferente de ps_endpoints/ps_aors/
// ps_identifies, que o Asterisk resolve on-demand via Realtime a cada request. Sem isso, criar/
// ativar uma trunk outbound nunca chega a instanciar o cliente de REGISTER (fica só a linha no
// banco, sem nenhum pacote saindo), e desativar deixa o cliente antigo rodando em memória até o
// próximo reload/retry natural. `module reload` (não `pjsip reload` inteiro) recarrega só esse
// módulo - não derruba ps_endpoints/ps_aors/ps_identifies de nenhuma outra trunk da mesma instância.
const REGISTRATION_RELOAD_DEBOUNCE_MS = 500
let pendingRegistrationReload: Promise<void> | null = null

export function reloadOutboundRegistrations(): Promise<void> {
    if (pendingRegistrationReload) return pendingRegistrationReload
    pendingRegistrationReload = new Promise((resolve) => {
        setTimeout(async () => {
            try {
                await runAmiCommand('module reload res_pjsip_outbound_registration.so')
            } catch (error) {
                logger.warn({
                    event: 'pjsip.registration.reload.failed',
                    error: error instanceof Error ? error.message : String(error),
                })
            } finally {
                pendingRegistrationReload = null
                resolve()
            }
        }, REGISTRATION_RELOAD_DEBOUNCE_MS)
    })
    return pendingRegistrationReload
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

        const endpointExtras = endpointExtrasOf(opts)
        const aorExtras = aorExtrasOf(opts)

        if (opts.registrationMode === 'outbound') {
            const uri = hostUri(opts.host, opts.port)
            await tx.ps_aors.create({
                data: { id, contact: `sip:${uri}`, ...aorExtras },
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
                    force_rport: true,
                    rtp_symmetric: true,
                    rewrite_contact: true,
                    ...endpointExtras,
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
                await tx.ps_aors.create({
                    data: { id: endpointId, max_contacts: 5, remove_existing: false, ...aorExtras },
                })
                await tx.ps_endpoints.create({
                    data: {
                        id: endpointId, aors: endpointId, ...(hasAuth ? { auth: id } : {}), context: opts.context,
                        disallow: 'all', allow: opts.codecs, setvar: opts.setvar,
                        accountcode: opts.accountcode,
                        force_rport: true,
                        rtp_symmetric: true,
                        rewrite_contact: true,
                        ...endpointExtras,
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

    // Reconcilia ps_identifies com os DIDs atuais da trunk. Duas trunks pjsip outbound que
    // registram no mesmo host/provedor geram o mesmo match por IP - o Asterisk resolve o endpoint
    // errado de forma não-determinística (sem ORDER BY na query Realtime), TRUNKID sai errado e a
    // InboundRoute do DID não bate ("destino inválido" intermitente). match_header é um FILTRO
    // ADICIONAL sobre match, nunca substituto: a lookup Realtime do módulo ip identifier busca
    // candidatos por IP primeiro (WHERE match casa com a origem) e só then testa match_header nos
    // candidatos retornados - zerar `match` deixa a linha invisível pra essa query e NENHUM endpoint
    // é identificado (visto em produção: as 2 trunks compartilhando host ficaram com match_header
    // sozinho e toda chamada passou a cair em "No matching endpoint found"). Por isso mantemos match
    // por host sempre, e ligamos match_header por cima quando há >=1 DID vinculado - o host
    // compartilhado retorna as 2 linhas como candidatas e o padrão do To (número discado) desempata.
    // Sem DID vinculado ainda (trunk recém-criada, antes de qualquer InboundRoute), match_header fica
    // nulo - chamado por resyncTrunkIdentify (trunks.service.ts) a cada mudança de InboundRoute/trunk
    // que possa ter deixado ps_identifies desatualizado.
    async syncIdentify(tx: Tx, astId: string, endpointId: string, host: string | null | undefined, didNumbers: string[]) {
        if (isDynamicHost(host)) {
            await tx.ps_identifies.deleteMany({ where: { id: astId } })
            return
        }
        const matchHeader = didNumbers.length > 0 ? `To: (${didNumbers.join('|')})` : null
        await tx.ps_identifies.upsert({
            where: { id: astId },
            create: { id: astId, endpoint: endpointId, match: host, match_header: matchHeader },
            update: { match: host, match_header: matchHeader, endpoint: endpointId },
        })
    },

    // Renomeia a trunk (astId = `${asteriskId}-trunk-${name}`, ver toAsteriskId em trunks.service.ts)
    // nas tabelas que usam esse id como PK. Endpoint/aor só são afetados se identifyBy !== 'username'
    // (nesse caso o id deles já é o username, imune a rename de nome de trunk). Chamado ANTES do
    // resto de updateTrunk - a partir daqui o astId novo é tratado como "o atual" pro resto do fluxo.
    async renameTrunk(tx: Tx, oldAstId: string, newAstId: string, registrationMode: string, identifyBy?: 'ip' | 'username' | null) {
        const endpointIsAstId = !(registrationMode === 'inbound' && identifyBy === 'username')
        const hasAuthRow = registrationMode === 'outbound' || identifyBy === 'username'
        const endpointHasAuthField = registrationMode === 'inbound' && identifyBy === 'username'

        if (hasAuthRow) await tx.ps_auths.updateMany({ where: { id: oldAstId }, data: { id: newAstId } })

        if (endpointIsAstId) {
            await tx.ps_aors.updateMany({ where: { id: oldAstId }, data: { id: newAstId } })
            await tx.ps_endpoints.updateMany({
                where: { id: oldAstId },
                data: {
                    id: newAstId,
                    aors: newAstId,
                    ...(registrationMode === 'outbound' ? { outbound_auth: newAstId } : {}),
                },
            })
        } else if (endpointHasAuthField) {
            await tx.ps_endpoints.updateMany({ where: { auth: oldAstId }, data: { auth: newAstId } })
        }

        if (registrationMode === 'outbound') {
            await tx.ps_registrations.updateMany({ where: { id: oldAstId }, data: { id: newAstId, outbound_auth: newAstId } })
        }

        await tx.ps_identifies.updateMany({
            where: { id: oldAstId },
            data: { id: newAstId, ...(endpointIsAstId ? { endpoint: newAstId } : {}) },
        })
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

        const endpointUpdate: Record<string, any> = { ...endpointExtrasOf(opts) }
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
            const aorUpdate: Record<string, any> = { ...aorExtrasOf(opts) }
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
        } else {
            const aorUpdate = aorExtrasOf(opts)
            if (Object.keys(aorUpdate).length > 0)
                await tx.ps_aors.update({ where: { id: newEndpointId }, data: aorUpdate })
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
