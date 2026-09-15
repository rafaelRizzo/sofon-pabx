import { prisma } from '../../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// chan_iax2 realtime (iaxfriends/iaxusers/iaxpeers, ver setups/odbc-realtime.sh) - tabela única,
// pré-sorcery como chan_sip. Sem "register =>" dinâmico: Asterisk não tem equivalente ao
// ps_registrations do PJSIP pra IAX2, então "outbound" aqui é sempre peer estático IP-autenticado,
// nunca um REGISTER de verdade (ver trunks.service.ts).
const yesNo = (v?: boolean | null) => (v === undefined ? undefined : v ? 'yes' : 'no')

type IaxTrunkOpts = {
    host?: string
    username?: string
    password?: string
    context: string
    codecs: string
    registrationMode: string
    identifyBy?: 'ip' | 'username' | null
    setvar?: string
    accountcode: string
    qualify?: string | null
    trunkMode?: boolean | null
    encryption?: boolean | null
    transfer?: string | null
    jitterbuffer?: boolean | null
}

// name é a PK (mesmo lookup key usado pelo Asterisk pra REGISTER/auth) - igual identifyBy='username'
// do PjsipRepository, quando o inbound tem username explícito o "name" vira o próprio username
const nameFor = (astId: string, opts: Pick<IaxTrunkOpts, 'registrationMode' | 'identifyBy' | 'username'>) =>
    opts.registrationMode === 'inbound' && opts.identifyBy === 'username' ? opts.username! : astId

export const IaxRepository = {
    async createTrunk(tx: Tx, astId: string, opts: IaxTrunkOpts) {
        await tx.iax_friends.create({
            data: {
                name: nameFor(astId, opts),
                type: opts.registrationMode === 'outbound' ? 'peer' : 'friend',
                host: opts.registrationMode === 'outbound' ? opts.host! : (opts.host ?? 'dynamic'),
                secret: opts.password,
                context: opts.context,
                disallow: 'all',
                allow: opts.codecs,
                setvar: opts.setvar,
                accountcode: opts.accountcode,
                qualify: opts.qualify ?? 'yes',
                trunk: yesNo(opts.trunkMode) ?? 'no',
                encryption: yesNo(opts.encryption) ?? 'no',
                transfer: opts.transfer ?? 'mediaonly',
                jitterbuffer: yesNo(opts.jitterbuffer) ?? 'no',
            } as any,
        })
    },

    // Renomeia a trunk (astId, ver toAsteriskId em trunks.service.ts) - no-op se identifyBy='username',
    // já que aí "name" (PK de iax_friends) é o username, imune a rename de nome de trunk.
    async renameTrunk(tx: Tx, oldAstId: string, newAstId: string, registrationMode: string, identifyBy?: 'ip' | 'username' | null) {
        if (registrationMode === 'inbound' && identifyBy === 'username') return
        await tx.iax_friends.updateMany({ where: { name: oldAstId }, data: { name: newAstId } })
    },

    async updateTrunk(tx: Tx, astId: string, opts: Partial<IaxTrunkOpts> & { registrationMode: string, existingUsername?: string | null, existingIdentifyBy?: 'ip' | 'username' | null }) {
        const wasUsernameIdentity = opts.registrationMode === 'inbound' && opts.existingIdentifyBy === 'username'
        const isUsernameIdentity = opts.registrationMode === 'inbound' && opts.identifyBy === 'username'
        const oldName = wasUsernameIdentity ? opts.existingUsername! : astId
        const newName = isUsernameIdentity ? (opts.username ?? opts.existingUsername!) : astId

        const update: Record<string, any> = {}
        if (opts.host !== undefined && opts.registrationMode === 'outbound') update.host = opts.host
        if (opts.password !== undefined) update.secret = opts.password
        if (opts.context !== undefined) update.context = opts.context
        if (opts.codecs !== undefined) update.allow = opts.codecs
        if (opts.qualify !== undefined) update.qualify = opts.qualify
        if (opts.trunkMode !== undefined) update.trunk = yesNo(opts.trunkMode)
        if (opts.encryption !== undefined) update.encryption = yesNo(opts.encryption)
        if (opts.transfer !== undefined) update.transfer = opts.transfer
        if (opts.jitterbuffer !== undefined) update.jitterbuffer = yesNo(opts.jitterbuffer)
        if (newName !== oldName) update.name = newName

        if (Object.keys(update).length > 0)
            await tx.iax_friends.update({ where: { name: oldName }, data: update as any })
    },

    async deleteTrunk(tx: Tx, name: string) {
        await tx.iax_friends.deleteMany({ where: { name } })
    },

    async deleteManyByNames(tx: Tx, names: string[]) {
        if (names.length > 0)
            await tx.iax_friends.deleteMany({ where: { name: { in: names } } })
    },
}
