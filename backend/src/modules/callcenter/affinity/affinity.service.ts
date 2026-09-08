import { prisma } from '../../../lib/prisma'
import { toAsteriskInterface } from '../../../asterisk/queue.repository'

// Recalcula AgentAffinity (média de CallRating por extensão×empresa) e, a partir dela, o `penalty`
// dos queue_members realtime - app_queue tenta primeiro o grupo de menor penalty, independente da
// strategy configurada, então melhor afinidade = penalty mais baixo = tentado primeiro. Chamado
// periodicamente por src/jobs/agent-affinity-recalc.job.ts (mesmo padrão de holiday-resync.job.ts).
export const recalculateAffinity = async () => {
    // Só a nota de atendimento (o agente) entra na afinidade/penalty - a nota de serviço
    // contratado (CallRating.scoreServico) é só informativa, não mede desempenho do agente
    const stats = await prisma.callRating.groupBy({
        by: ['extensionId', 'companyId'],
        where: { scoreAtendimento: { not: null } },
        _avg: { scoreAtendimento: true },
        _count: { scoreAtendimento: true },
    })

    for (const s of stats) {
        const score = s._avg.scoreAtendimento ?? 0
        const sampleSize = s._count.scoreAtendimento
        await prisma.agentAffinity.upsert({
            where: { extensionId_companyId: { extensionId: s.extensionId, companyId: s.companyId } },
            update: { score, sampleSize },
            create: { extensionId: s.extensionId, companyId: s.companyId, score, sampleSize },
        })
    }

    const companyIds = [...new Set(stats.map((s) => s.companyId))]
    for (const companyId of companyIds) await recalculatePenaltiesForCompany(companyId)

    return { companies: companyIds.length, agents: stats.length }
}

// Dentro de cada fila, ordena os membros por AgentAffinity.score desc (melhor primeiro) e grava o
// rank como penalty (0 = melhor). Agente sem nota ainda entra por último (score default 0).
export const recalculatePenaltiesForCompany = async (companyId: string) => {
    const queues = await prisma.queue.findMany({
        where: { companyId, callcenterEnabled: true },
        select: {
            name: true,
            company: { select: { asteriskId: true } },
            members: {
                select: { extensionId: true, extension: { select: { type: true, number: true } } },
            },
        },
    })

    for (const queue of queues) {
        if (queue.members.length === 0) continue

        const affinities = await prisma.agentAffinity.findMany({
            where: { companyId, extensionId: { in: queue.members.map((m) => m.extensionId) } },
        })
        const scoreByExtension = new Map(affinities.map((a) => [a.extensionId, a.score]))
        const ranked = [...queue.members].sort(
            (a, b) => (scoreByExtension.get(b.extensionId) ?? 0) - (scoreByExtension.get(a.extensionId) ?? 0)
        )

        const asteriskQueueName = `${queue.company.asteriskId}-${queue.name}`
        for (let rank = 0; rank < ranked.length; rank++) {
            const member = ranked[rank]!
            const iface = toAsteriskInterface(member.extension.type, member.extension.number)
            await prisma.queue_members.updateMany({
                where: { queue_name: asteriskQueueName, interface: iface },
                data: { penalty: rank },
            })
        }
    }
}
