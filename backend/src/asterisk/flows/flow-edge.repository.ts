import { prisma } from '../../lib/prisma'
import type { RouteDestination } from '../../schemas/route-destination.schema'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type FlowEdgeRow = { sourceId: string; slot: string; targetType: string | null; targetId: string | null }

// Identifica o model dono do slot - mesma nomenclatura em minúsculo do model Prisma.
export type FlowSourceType =
    | 'inboundroute' | 'timecondition' | 'holidaygroup' | 'announcement' | 'ivrmenu'
    | 'ivroption' | 'requesttemplate' | 'ixcnode' | 'variableset' | 'variablecondition' | 'queue' | 'flow'

function groupBySourceId(rows: FlowEdgeRow[]): Map<string, Record<string, RouteDestination>> {
    const map = new Map<string, Record<string, RouteDestination>>()
    for (const row of rows) {
        const slots = map.get(row.sourceId) ?? {}
        slots[row.slot] = row.targetType ? ({ type: row.targetType, id: row.targetId } as RouteDestination) : null
        map.set(row.sourceId, slots)
    }
    return map
}

export const FlowEdgeRepository = {
    // Upsert-ou-delete de UM slot só - não mexe nos outros slots da mesma origem (necessário pras
    // entidades com múltiplos campos de destino, ex: IvrMenu invalid/timeout/long, onde um update
    // parcial só manda o slot que mudou). dest null/hangup = ausência de linha pro slot.
    async setSlot(tx: Tx, companyId: string, sourceType: FlowSourceType, sourceId: string, slot: string, dest: RouteDestination) {
        if (!dest || dest.type === 'hangup') {
            await tx.flowEdge.deleteMany({ where: { sourceType, sourceId, slot } })
            return
        }
        const targetId = 'id' in dest ? dest.id : null
        await tx.flowEdge.upsert({
            where: { sourceType_sourceId_slot: { sourceType, sourceId, slot } },
            create: { companyId, sourceType, sourceId, slot, targetType: dest.type, targetId },
            update: { targetType: dest.type, targetId },
        })
    },

    // Remove TODOS os slots de uma origem - chamado quando a própria entidade dona é deletada
    // (Announcement, IvrMenu, etc.), já que não há FK real de FlowEdge.sourceId pra tabela dona
    // (sourceType varia por linha, uma FK só não dá pra apontar pra N tabelas).
    async deleteAllForSource(tx: Tx, sourceType: FlowSourceType, sourceId: string) {
        await tx.flowEdge.deleteMany({ where: { sourceType, sourceId } })
    },

    // Variante em lote - usada só por IvrMenu ao substituir a lista inteira de IvrOption (os ids
    // antigos deixam de existir, seus FlowEdge ficariam órfãos sem essa limpeza).
    async deleteAllForSources(tx: Tx, sourceType: FlowSourceType, sourceIds: string[]) {
        if (sourceIds.length === 0) return
        await tx.flowEdge.deleteMany({ where: { sourceType, sourceId: { in: sourceIds } } })
    },

    // 1 query por regenerate() da empresa inteira (WHERE companyId+sourceType) - agrupado em
    // memória, sem N+1 por linha da entidade dona.
    async getBySource(companyId: string, sourceType: FlowSourceType): Promise<Map<string, Record<string, RouteDestination>>> {
        return groupBySourceId(await prisma.flowEdge.findMany({ where: { companyId, sourceType } }))
    },

    // Variante sem companyId - usada por listagens cross-empresa (ex: getAllTimeConditions sem
    // filtro, visão admin), onde sourceId (cuid) já é globalmente único, sem precisar do companyId
    // pra escopar a query.
    async getBySourceIds(sourceType: FlowSourceType, sourceIds: string[]): Promise<Map<string, Record<string, RouteDestination>>> {
        if (sourceIds.length === 0) return new Map()
        return groupBySourceId(await prisma.flowEdge.findMany({ where: { sourceType, sourceId: { in: sourceIds } } }))
    },

    // leitura de uma única origem/slot - usada nos getXById (1 query extra, mesmo padrão N+0 que
    // já existia lendo o campo Json direto da linha).
    async getOne(sourceType: FlowSourceType, sourceId: string, slot: string): Promise<RouteDestination> {
        const row = await prisma.flowEdge.findUnique({
            where: { sourceType_sourceId_slot: { sourceType, sourceId, slot } },
        })
        return row?.targetType ? ({ type: row.targetType, id: row.targetId } as RouteDestination) : null
    },

    // reverse-lookup indexado (targetType+targetId) - base do guard de delete em
    // route-destination.validate.ts::assertNotReferenced.
    async getReferencesTo(targetType: string, targetId: string) {
        return prisma.flowEdge.findMany({
            where: { targetType, targetId },
            select: { sourceType: true, sourceId: true, slot: true },
        })
    },

    // Variante em lote de getReferencesTo - 1 query pra resolver "quem referencia" de todos os
    // ids visíveis numa tabela de uma vez (usado pelo indicador "usado por" no frontend, ver
    // flow-reference-label.ts), não 1 por linha.
    async getReferencesToMany(targetType: string, targetIds: string[]): Promise<Map<string, { sourceType: string; sourceId: string; slot: string }[]>> {
        if (targetIds.length === 0) return new Map()
        const rows = await prisma.flowEdge.findMany({
            where: { targetType, targetId: { in: targetIds } },
            select: { sourceType: true, sourceId: true, slot: true, targetId: true },
        })
        const map = new Map<string, { sourceType: string; sourceId: string; slot: string }[]>()
        for (const row of rows) {
            const list = map.get(row.targetId!) ?? []
            list.push({ sourceType: row.sourceType, sourceId: row.sourceId, slot: row.slot })
            map.set(row.targetId!, list)
        }
        return map
    },
}
