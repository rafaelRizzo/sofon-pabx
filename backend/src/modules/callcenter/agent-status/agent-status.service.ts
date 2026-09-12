import { prisma } from '../../../lib/prisma'
import * as QueueMembersService from '../../queue-members/queue-members.service'
import type { SetAgentStatusInput } from './schemas/agent-status.schema'
import { AppError } from '../../../utils/errors/app.error'

const resolveAgentExtension = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { extensionId: true } })
    if (!user?.extensionId) throw new AppError('Nenhum ramal vinculado a este usuário', 404)

    const extension = await prisma.extension.findUnique({
        where: { id: user.extensionId },
        select: { id: true, companyId: true },
    })
    if (!extension) throw new AppError('Extension not found', 404)
    return extension
}

const buildStatus = async (extensionId: string, companyId: string) => {
    const [members, availableReasons] = await Promise.all([
        prisma.queueMember.findMany({
            where: { extensionId },
            select: {
                id: true,
                paused: true,
                pauseReason: true,
                queue: { select: { id: true, name: true, number: true } },
            },
        }),
        prisma.pauseReason.findMany({
            where: { companyId, active: true },
            select: { id: true, label: true },
            orderBy: { label: 'asc' },
        }),
    ])

    // "Pausado" no agregado só quando todas as filas em que o agente está estão pausadas -
    // membership parcial (ex: admin pausou só 1 fila pela tela de gestão) aparece como
    // disponível aqui, mas o detalhe por fila (queues[]) continua exato pra UI decidir o que mostrar.
    const paused = members.length > 0 && members.every((m) => m.paused)
    const pauseReason = paused ? (members.find((m) => m.pauseReason)?.pauseReason ?? null) : null

    return {
        extensionId,
        paused,
        pauseReason,
        queues: members.map((m) => ({
            queueId: m.queue.id,
            queueName: m.queue.name,
            queueNumber: m.queue.number,
            paused: m.paused,
            pauseReason: m.pauseReason,
        })),
        availableReasons,
    }
}

export const getMyStatus = async (userId: string) => {
    const extension = await resolveAgentExtension(userId)
    return buildStatus(extension.id, extension.companyId)
}

export const setMyStatus = async (userId: string, data: SetAgentStatusInput) => {
    const extension = await resolveAgentExtension(userId)

    let pauseReasonLabel: string | null = null
    if (data.paused) {
        if (!data.pauseReasonId) throw new AppError('Selecione um motivo de pausa', 400)
        const reason = await prisma.pauseReason.findUnique({ where: { id: data.pauseReasonId } })
        if (!reason || reason.companyId !== extension.companyId || !reason.active)
            throw new AppError('Motivo de pausa inválido para esta empresa', 400)
        pauseReasonLabel = reason.label
    }

    const members = await prisma.queueMember.findMany({
        where: { extensionId: extension.id },
        select: { id: true, queueId: true },
    })

    for (const member of members) {
        await QueueMembersService.updateMember(member.queueId, member.id, {
            paused: data.paused,
            pauseReason: pauseReasonLabel,
        })
    }

    return buildStatus(extension.id, extension.companyId)
}
