import type { ParsedIssabelDump, IssabelQueueMember } from './issabel.parser'

const QUEUE_STRATEGIES = new Set(['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory', 'linear', 'wrandom'])

const yesNoToBool = (value: string | undefined, fallback: boolean) =>
    value === undefined ? fallback : value.toLowerCase() === 'yes'

const clampInt = (value: string | undefined, min: number, max: number, fallback: number) => {
    const n = Number.parseInt(value ?? '', 10)
    if (Number.isNaN(n)) return fallback
    return Math.min(max, Math.max(min, n))
}

// codecs no Issabel vêm "ulaw&alaw&g729" (chan_sip) - nosso schema usa csv
const mapCodecs = (allow: string | undefined) => allow?.split('&').filter(Boolean).join(',') || undefined

const slugify = (value: string, fallback: string) => {
    const slug = value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return slug.length ? slug : fallback
}

export type MappedExtension = {
    issabelId: string
    input: Record<string, unknown>
}

/** Só ramais chan_sip (`devicetype=fixed`, tech `sip`) - Issabel legado não tem PJSIP nesse dump. */
export const mapExtensions = (parsed: ParsedIssabelDump, companyId: string): { extensions: MappedExtension[]; skipped: string[] } => {
    const extensions: MappedExtension[] = []
    const skipped: string[] = []

    for (const device of parsed.devices) {
        if (device.tech.toLowerCase() !== 'sip') {
            skipped.push(`Ramal ${device.id}: tecnologia "${device.tech}" não suportada (só chan_sip)`)
            continue
        }
        if (!/^\d{2,6}$/.test(device.id)) {
            skipped.push(`Ramal ${device.id}: número fora do padrão aceito (2-6 dígitos)`)
            continue
        }

        const user = parsed.usersByExtension.get(device.id)
        const peer = parsed.sip.get(device.id)
        const name = user?.name?.trim() || device.description?.trim() || device.id

        extensions.push({
            issabelId: device.id,
            input: {
                alias: device.id,
                name,
                companyId,
                type: 'sip',
                allow: mapCodecs(peer?.get('allow')),
            },
        })
    }

    return { extensions, skipped }
}

export type MappedTrunk = { issabelId: string; input: Record<string, unknown> }

const makeUniqueTrunkName = () => {
    const used = new Set<string>()
    return (rawName: string, trunkid: string) => {
        let name = slugify(rawName, `trunk-${trunkid}`).slice(0, 20)
        if (used.has(name)) name = `${name.slice(0, 20 - trunkid.length - 1)}-${trunkid}`
        used.add(name)
        return name
    }
}

/**
 * Sempre importado como registrationMode="inbound" (sem registro de saída ativo) - o objetivo aqui
 * é trazer o tronco pro banco de forma inofensiva; ligar o registro de fato é decisão manual
 * posterior do admin. host="dynamic" no Issabel (peer identificado por usuário/senha, não IP) vira
 * identifyBy="username"; host fixo vira identifyBy="ip" (mesmo comportamento que o peer já tinha).
 */
export const mapTrunks = (parsed: ParsedIssabelDump, companyId: string): { trunks: MappedTrunk[]; skipped: string[] } => {
    const trunks: MappedTrunk[] = []
    const skipped: string[] = []
    const uniqueTrunkName = makeUniqueTrunkName()

    for (const trunk of parsed.trunks) {
        const tech = trunk.tech.toLowerCase()
        if (tech !== 'sip' && tech !== 'iax') {
            skipped.push(`Tronco ${trunk.name || trunk.trunkid}: tecnologia "${trunk.tech}" não suportada`)
            continue
        }

        const eav = tech === 'iax' ? parsed.iax : parsed.sip
        const peer = eav.get(`tr-peer-${trunk.trunkid}`)
        if (!peer) {
            skipped.push(`Tronco ${trunk.name || trunk.trunkid}: sem configuração de peer no dump`)
            continue
        }

        const host = peer.get('host')
        const isDynamic = !host || host === 'dynamic'

        trunks.push({
            issabelId: trunk.trunkid,
            input: {
                name: uniqueTrunkName(trunk.name, trunk.trunkid),
                companyId,
                type: tech === 'iax' ? 'iax' : 'pjsip',
                registrationMode: 'inbound',
                codecs: mapCodecs(peer.get('allow')),
                ...(isDynamic
                    ? { username: peer.get('username') || undefined, password: peer.get('secret') || undefined }
                    : { host }),
            },
        })
    }

    return { trunks, skipped }
}

export type MappedQueue = {
    issabelId: string
    input: Record<string, unknown>
    members: IssabelQueueMember[]
}

export const mapQueues = (parsed: ParsedIssabelDump, companyId: string): { queues: MappedQueue[]; skipped: string[] } => {
    const queues: MappedQueue[] = []
    const skipped: string[] = []

    for (const q of parsed.queuesConfig) {
        if (!/^\d+$/.test(q.extension)) {
            skipped.push(`Fila ${q.extension}: número fora do padrão aceito (só dígitos)`)
            continue
        }

        const details = parsed.queueDetailsByExtension.get(q.extension)
        const settings = details?.settings
        const strategy = settings?.get('strategy')

        queues.push({
            issabelId: q.extension,
            input: {
                name: slugify(q.descr || `fila-${q.extension}`, `fila-${q.extension}`),
                number: q.extension,
                companyId,
                strategy: strategy && QUEUE_STRATEGIES.has(strategy) ? strategy : undefined,
                musicOnHold: settings?.get('music') || undefined,
                timeout: clampInt(settings?.get('timeout'), 1, 300, 15),
                retry: clampInt(settings?.get('retry'), 1, 300, 5),
                maxLen: clampInt(settings?.get('maxlen'), 0, 1_000_000, 0),
                wrapupTime: clampInt(settings?.get('wrapuptime'), 0, 1_000_000, 5),
                joinEmpty: yesNoToBool(settings?.get('joinempty'), true),
                leaveWhenEmpty: yesNoToBool(settings?.get('leavewhenempty'), false),
            },
            members: details?.members ?? [],
        })
    }

    return { queues, skipped }
}
