import { prisma } from '../lib/prisma'
import type { RouteDestination } from './route-destination.schema'
import { ExtensionsCache } from '../modules/extensions/cache/extensions.cache'
import { QueuesCache } from '../modules/queues/cache/queues.cache'
import { TimeConditionsCache } from '../modules/time-conditions/cache/time-conditions.cache'
import { HolidayGroupsCache } from '../modules/holiday-groups/cache/holiday-groups.cache'
import { AnnouncementsCache } from '../modules/announcements/cache/announcements.cache'
import { IvrCache } from '../modules/ivr/cache/ivr.cache'
import { RequestTemplatesCache } from '../modules/request-templates/cache/request-templates.cache'
import { IxcNodesCache } from '../modules/ixc-nodes/cache/ixc-nodes.cache'
import { VariablesCache } from '../modules/variables/cache/variables.cache'
import { VariableConditionsCache } from '../modules/variable-conditions/cache/variable-conditions.cache'

// Resolve o nome legível de cada tipo de destino, cache-first — reaproveita o cache de listagem
// já mantido/invalidado por cada módulo (XxxCache.getByCompany), sem criar um cache novo pra
// manter em dia. No miss faz uma query direta mínima, mas NUNCA popula esse cache aqui: gravar um
// shape parcial (só id/nome) por cima da chave usada pelo DTO completo do módulo corromperia a
// listagem normal daquele recurso. Um miss só custa uma query a mais até o próximo GET normal do
// módulo aquecer o cache de novo.
type LabelFetcher = (companyId: string) => Promise<Map<string, string>>

// Mocks parciais de Cache em testes de OUTROS módulos (ex: só { getExtension, setExtension })
// vazam pra cá porque bun test compartilha o module registry entre arquivos do mesmo processo
// (mock.module não é escopado por arquivo) — sem essa guarda, um teste que nem toca destino tipo
// "extension" quebra por causa do mock de outro arquivo faltar getByCompany.
async function safeGetByCompany<T>(cache: { getByCompany?: (companyId: string) => Promise<T | null> }, companyId: string): Promise<T | null> {
    if (typeof cache.getByCompany !== 'function') return null
    return cache.getByCompany(companyId)
}

const extensionLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(ExtensionsCache, companyId)) as
        | { sip?: { id: string; alias: string; name: string }[]; pjsip?: { id: string; alias: string; name: string }[] }
        | null
    const grouped =
        cached ??
        (await (async () => {
            const exts = await prisma.extension.findMany({ where: { companyId }, select: { id: true, alias: true, name: true } })
            return { sip: exts, pjsip: [] }
        })())
    const all = [...(grouped.sip ?? []), ...(grouped.pjsip ?? [])]
    return new Map(all.map((e) => [e.id, `${e.alias} - ${e.name}`]))
}

const queueLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(QueuesCache, companyId)) as { id: string; name: string; number: string }[] | null
    const list = cached ?? (await prisma.queue.findMany({ where: { companyId }, select: { id: true, name: true, number: true } }))
    return new Map(list.map((q) => [q.id, `${q.name} (${q.number})`]))
}

const timeConditionLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(TimeConditionsCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.timeCondition.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((t) => [t.id, t.name]))
}

const holidayLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(HolidayGroupsCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.holidayGroup.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((h) => [h.id, h.name]))
}

const announcementLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(AnnouncementsCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.announcement.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((a) => [a.id, a.name]))
}

const ivrLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(IvrCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.ivrMenu.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((i) => [i.id, i.name]))
}

const requestTemplateLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(RequestTemplatesCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.requestTemplate.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((r) => [r.id, r.name]))
}

const ixcNodeLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(IxcNodesCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.ixcNode.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((n) => [n.id, n.name]))
}

const variableSetLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(VariablesCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.variableSet.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((v) => [v.id, v.name]))
}

const variableConditionLabels: LabelFetcher = async (companyId) => {
    const cached = (await safeGetByCompany(VariableConditionsCache, companyId)) as { id: string; name: string }[] | null
    const list = cached ?? (await prisma.variableCondition.findMany({ where: { companyId }, select: { id: true, name: true } }))
    return new Map(list.map((v) => [v.id, v.name]))
}

// voicemail não entra aqui — id livre sem FK (ver route-destination.validate.ts), não há registro
// pra resolver nome
const LABEL_FETCHERS: Partial<Record<string, LabelFetcher>> = {
    extension: extensionLabels,
    queue: queueLabels,
    timecondition: timeConditionLabels,
    holiday: holidayLabels,
    announcement: announcementLabels,
    ivr: ivrLabels,
    request: requestTemplateLabels,
    ixc: ixcNodeLabels,
    'variable-set': variableSetLabels,
    'variable-condition': variableConditionLabels,
}

// Resolve o label de N destinos de uma vez, batcheando por tipo — 1 lookup (cache-first) por
// tipo presente entre os destinos passados, não 1 por destino. Chave do Map é "type:id", mesmo
// formato que o frontend usava antes de o backend passar a resolver isso (route-destination-badge.tsx).
export async function resolveDestinationLabels(
    destinations: (RouteDestination | null | undefined)[],
    companyId: string,
): Promise<Map<string, string>> {
    const types = new Set<string>()
    for (const d of destinations) {
        if (d && LABEL_FETCHERS[d.type]) types.add(d.type)
    }
    if (types.size === 0) return new Map()

    const results = await Promise.all(
        [...types].map(async (type) => [type, await LABEL_FETCHERS[type]!(companyId)] as const),
    )

    const map = new Map<string, string>()
    for (const [type, idToLabel] of results) {
        for (const [id, label] of idToLabel) map.set(`${type}:${id}`, label)
    }
    return map
}

// Aplica o label resolvido a um destino — usado no toDto de cada módulo. hangup/sem id não tem
// o que resolver, passa direto.
export function withDestinationLabel<T extends RouteDestination>(
    dest: T,
    labelMap: Map<string, string>,
): T {
    if (!dest || dest.type === 'hangup' || !('id' in dest)) return dest
    return { ...dest, label: labelMap.get(`${dest.type}:${dest.id}`) ?? null } as T
}
