// One-off: popula a tabela flow_edges a partir dos campos Json antigos (trueRoute/falseRoute/
// destination/invalidDestination/timeoutDestination/longDestination/onSuccess/onError/
// postQueueDestination) que ainda existem nas tabelas — rodar UMA VEZ depois de aplicar a migration
// que criou FlowEdge, antes de uma segunda migration remover essas colunas antigas do schema.
// Idempotente (setSlot faz upsert-ou-delete por slot, pode rodar de novo sem duplicar). Rodar:
//   bun run src/scripts/backfill-flow-edges.ts
import { prisma } from '../lib/prisma'
import { FlowEdgeRepository } from '../asterisk/flow-edge.repository'
import type { RouteDestination } from '../schemas/route-destination.schema'

async function main() {
    const companies = await prisma.company.findMany({ select: { id: true } })
    console.log(`Backfill de FlowEdge — ${companies.length} empresa(s)`)

    for (const { id: companyId } of companies) {
        const [
            inboundRoutes, timeConditions, holidayGroups, announcements, ivrMenus,
            requestTemplates, variableSets, variableConditions, queues,
        ] = await Promise.all([
            prisma.inboundRoute.findMany({ where: { companyId }, select: { id: true, destination: true } }),
            prisma.timeCondition.findMany({ where: { companyId }, select: { id: true, trueRoute: true, falseRoute: true } }),
            prisma.holidayGroup.findMany({ where: { companyId }, select: { id: true, trueRoute: true, falseRoute: true } }),
            prisma.announcement.findMany({ where: { companyId }, select: { id: true, destination: true } }),
            prisma.ivrMenu.findMany({
                where: { companyId },
                select: {
                    id: true, invalidDestination: true, timeoutDestination: true, longDestination: true,
                    options: { select: { id: true, destination: true } },
                },
            }),
            prisma.requestTemplate.findMany({ where: { companyId }, select: { id: true, onSuccess: true, onError: true } }),
            prisma.variableSet.findMany({ where: { companyId }, select: { id: true, destination: true } }),
            prisma.variableCondition.findMany({ where: { companyId }, select: { id: true, trueRoute: true, falseRoute: true } }),
            prisma.queue.findMany({ where: { companyId }, select: { id: true, postQueueDestination: true } }),
        ])

        for (const r of inboundRoutes)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'inboundroute', r.id, 'default', r.destination as RouteDestination)

        for (const tc of timeConditions) {
            await FlowEdgeRepository.setSlot(prisma, companyId, 'timecondition', tc.id, 'true', tc.trueRoute as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'timecondition', tc.id, 'false', tc.falseRoute as RouteDestination)
        }

        for (const hg of holidayGroups) {
            await FlowEdgeRepository.setSlot(prisma, companyId, 'holidaygroup', hg.id, 'true', hg.trueRoute as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'holidaygroup', hg.id, 'false', hg.falseRoute as RouteDestination)
        }

        for (const a of announcements)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'announcement', a.id, 'default', a.destination as RouteDestination)

        for (const m of ivrMenus) {
            await FlowEdgeRepository.setSlot(prisma, companyId, 'ivrmenu', m.id, 'invalid', m.invalidDestination as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'ivrmenu', m.id, 'timeout', m.timeoutDestination as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'ivrmenu', m.id, 'long', m.longDestination as RouteDestination)
            for (const o of m.options)
                await FlowEdgeRepository.setSlot(prisma, companyId, 'ivroption', o.id, 'default', o.destination as RouteDestination)
        }

        for (const rt of requestTemplates) {
            await FlowEdgeRepository.setSlot(prisma, companyId, 'requesttemplate', rt.id, 'success', rt.onSuccess as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'requesttemplate', rt.id, 'error', rt.onError as RouteDestination)
        }

        for (const vs of variableSets)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'variableset', vs.id, 'default', vs.destination as RouteDestination)

        for (const vc of variableConditions) {
            await FlowEdgeRepository.setSlot(prisma, companyId, 'variablecondition', vc.id, 'true', vc.trueRoute as RouteDestination)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'variablecondition', vc.id, 'false', vc.falseRoute as RouteDestination)
        }

        for (const q of queues)
            await FlowEdgeRepository.setSlot(prisma, companyId, 'queue', q.id, 'default', q.postQueueDestination as RouteDestination)

        console.log(`→ empresa ${companyId} ok`)
    }

    console.log('Backfill concluído.')
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => process.exit(0))
