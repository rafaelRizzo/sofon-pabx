import { extractTableRows } from './sql-dump.parser'

export type IssabelDevice = {
    id: string
    tech: string
    description: string | null
}

export type IssabelUser = {
    extension: string
    name: string | null
}

// tabelas EAV do chan_sip/IAX2 (`sip`/`iax`): PK (id, keyword) -> data. Ramal usa o próprio número
// como id; tronco usa "tr-peer-<trunkid>" (auth/codec) e "tr-reg-<trunkid>" (string de registro)
export type IssabelEavTable = Map<string, Map<string, string>>

export type IssabelQueueConfig = {
    extension: string
    descr: string
}

export type IssabelQueueMember = {
    kind: 'sip' | 'agent' | 'other'
    // número do ramal (só quando kind === 'sip')
    number: string | null
    penalty: number
}

export type IssabelQueueDetails = {
    settings: Map<string, string>
    members: IssabelQueueMember[]
}

export type IssabelTrunk = {
    trunkid: string
    name: string
    tech: string
}

export type ParsedIssabelDump = {
    devices: IssabelDevice[]
    usersByExtension: Map<string, IssabelUser>
    sip: IssabelEavTable
    iax: IssabelEavTable
    queuesConfig: IssabelQueueConfig[]
    queueDetailsByExtension: Map<string, IssabelQueueDetails>
    trunks: IssabelTrunk[]
}

const buildEavTable = (rows: (string | null)[][]): IssabelEavTable => {
    const table: IssabelEavTable = new Map()
    for (const [id, keyword, data] of rows) {
        if (id == null || keyword == null) continue
        if (!table.has(id)) table.set(id, new Map())
        table.get(id)!.set(keyword, data ?? '')
    }
    return table
}

// "SIP/2003,2" -> { kind: 'sip', number: '2003', penalty: 2 } / "Agent/97,0" -> kind 'agent'
const parseMember = (raw: string): IssabelQueueMember => {
    const [iface, penaltyRaw] = raw.split(',')
    const penalty = Number.parseInt(penaltyRaw ?? '0', 10) || 0
    const match = /^(SIP|PJSIP)\/(\d+)/i.exec(iface ?? '')
    if (match) return { kind: 'sip', number: match[2] ?? null, penalty }
    if (/^Agent\//i.test(iface ?? '')) return { kind: 'agent', number: null, penalty }
    return { kind: 'other', number: null, penalty }
}

export const parseIssabelDump = (sql: string): ParsedIssabelDump => {
    const devices: IssabelDevice[] = extractTableRows(sql, 'devices').map(([id, tech, , , , description]) => ({
        id: id ?? '',
        tech: tech ?? '',
        description: description ?? null,
    }))

    const usersByExtension = new Map<string, IssabelUser>()
    for (const [extension, , name] of extractTableRows(sql, 'users')) {
        if (!extension) continue
        usersByExtension.set(extension, { extension, name: name ?? null })
    }

    const sip = buildEavTable(extractTableRows(sql, 'sip'))
    const iax = buildEavTable(extractTableRows(sql, 'iax'))

    const queuesConfig: IssabelQueueConfig[] = extractTableRows(sql, 'queues_config').map(([extension, descr]) => ({
        extension: extension ?? '',
        descr: descr ?? '',
    }))

    const queueDetailsByExtension = new Map<string, IssabelQueueDetails>()
    for (const [id, keyword, data] of extractTableRows(sql, 'queues_details')) {
        if (!id || !keyword) continue
        if (!queueDetailsByExtension.has(id)) queueDetailsByExtension.set(id, { settings: new Map(), members: [] })
        const details = queueDetailsByExtension.get(id)!
        if (keyword === 'member') {
            if (data) details.members.push(parseMember(data))
        } else {
            details.settings.set(keyword, data ?? '')
        }
    }

    const trunks: IssabelTrunk[] = extractTableRows(sql, 'trunks').map(([trunkid, name, tech]) => ({
        trunkid: trunkid ?? '',
        name: name ?? '',
        tech: tech ?? '',
    }))

    return { devices, usersByExtension, sip, iax, queuesConfig, queueDetailsByExtension, trunks }
}
