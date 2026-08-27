import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { FlowEdgeRepository, type FlowSourceType } from '../asterisk/flow-edge.repository'

// Shape de resposta compartilhado por todo módulo que expõe o indicador "usado por" - ver
// resolveUsedByLabels abaixo.
export const usedBySchema = z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    slot: z.string(),
    label: z.string(),
})).describe('Fluxos que apontam pra este registro como destino - vazio quando não referenciado')

// Espelha route-destination-label.ts, mas na direção inversa: resolve o nome de quem APONTA pra
// um destino (sourceType/sourceId), não o nome do destino em si. Sem cache-first aqui de propósito
// - misturar com o cache de cada módulo (shape de DTO completo, não só id/nome) arriscaria a mesma
// contaminação entre testes que route-destination-label.ts evita com safeGetByCompany; esse
// indicador é carregado 1x por tabela, não em request quente o bastante pra justificar a
// complexidade extra.
type NameFetcher = (companyId: string, ids: string[]) => Promise<Map<string, string>>

const bySelect = async <T extends { id: string }>(
    find: (where: { companyId: string; id: { in: string[] } }) => Promise<T[]>,
    companyId: string,
    ids: string[],
    toLabel: (row: T) => string,
): Promise<Map<string, string>> => {
    const rows = await find({ companyId, id: { in: ids } })
    return new Map(rows.map((r) => [r.id, toLabel(r)]))
}

const inboundRouteNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.inboundRoute.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const timeConditionNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.timeCondition.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const holidayGroupNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.holidayGroup.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const announcementNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.announcement.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const ivrMenuNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.ivrMenu.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const requestTemplateNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.requestTemplate.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const ixcNodeNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.ixcNode.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const variableSetNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.variableSet.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const variableConditionNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.variableCondition.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const queueNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.queue.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

const flowNames: NameFetcher = (companyId, ids) =>
    bySelect(
        (where) => prisma.flow.findMany({ where, select: { id: true, name: true } }),
        companyId, ids, (r) => r.name,
    )

// IvrOption não tem nome próprio - identifica pelo menu pai + dígito ("Menu Principal, opção 3")
const ivrOptionNames: NameFetcher = async (companyId, ids) => {
    const options = await prisma.ivrOption.findMany({
        where: { id: { in: ids }, ivrMenu: { companyId } },
        select: { id: true, digit: true, ivrMenu: { select: { name: true } } },
    })
    return new Map(options.map((o) => [o.id, `${o.ivrMenu.name}, opção ${o.digit}`]))
}

const NAME_FETCHERS: Record<FlowSourceType, NameFetcher> = {
    inboundroute: inboundRouteNames,
    timecondition: timeConditionNames,
    holidaygroup: holidayGroupNames,
    announcement: announcementNames,
    ivrmenu: ivrMenuNames,
    ivroption: ivrOptionNames,
    requesttemplate: requestTemplateNames,
    ixcnode: ixcNodeNames,
    variableset: variableSetNames,
    variablecondition: variableConditionNames,
    queue: queueNames,
    flow: flowNames,
}

const TYPE_LABELS: Record<FlowSourceType, string> = {
    inboundroute: 'Rota de entrada',
    timecondition: 'Condição de horário',
    holidaygroup: 'Grupo de feriados',
    announcement: 'Anúncio',
    ivrmenu: 'Menu IVR',
    ivroption: 'Opção de IVR',
    requesttemplate: 'Requisição HTTP',
    ixcnode: 'IXCsoft',
    variableset: 'Variáveis',
    variablecondition: 'Condição de variável',
    queue: 'Fila',
    flow: 'Flow',
}

// slot 'default' não aparece no label - só existe 1 destino nessa origem, não precisa desambiguar
const SLOT_LABELS: Partial<Record<string, string>> = {
    true: 'verdadeiro',
    false: 'falso',
    invalid: 'dígito inválido',
    timeout: 'tempo esgotado',
    long: 'sequência longa',
    success: 'sucesso',
    error: 'erro',
}

export type UsedByRef = z.infer<typeof usedBySchema>[number]

// Resolve o label de exibição de cada referência reversa de um lote de ids (mesmo targetType),
// batcheando por sourceType - 1 query por tipo de origem presente, não 1 por referência.
export async function resolveUsedByLabels(
    targetType: string,
    targetIds: string[],
    companyId: string,
): Promise<Map<string, UsedByRef[]>> {
    if (targetIds.length === 0) return new Map()

    const refsByTarget = await FlowEdgeRepository.getReferencesToMany(targetType, targetIds)
    if (refsByTarget.size === 0) return new Map()

    const idsBySourceType = new Map<FlowSourceType, Set<string>>()
    for (const refs of refsByTarget.values()) {
        for (const ref of refs) {
            const sourceType = ref.sourceType as FlowSourceType
            const set = idsBySourceType.get(sourceType) ?? new Set<string>()
            set.add(ref.sourceId)
            idsBySourceType.set(sourceType, set)
        }
    }

    const nameMaps = new Map(
        await Promise.all(
            [...idsBySourceType.entries()].map(async ([sourceType, ids]) =>
                [sourceType, await NAME_FETCHERS[sourceType](companyId, [...ids])] as const,
            ),
        ),
    )

    const result = new Map<string, UsedByRef[]>()
    for (const [targetId, refs] of refsByTarget) {
        result.set(targetId, refs.map((ref) => {
            const sourceType = ref.sourceType as FlowSourceType
            const name = nameMaps.get(sourceType)?.get(ref.sourceId) ?? '(removido)'
            const slotLabel = SLOT_LABELS[ref.slot]
            const label = slotLabel ? `${TYPE_LABELS[sourceType]}: ${name} (${slotLabel})` : `${TYPE_LABELS[sourceType]}: ${name}`
            return { sourceType: ref.sourceType, sourceId: ref.sourceId, slot: ref.slot, label }
        }))
    }
    return result
}
