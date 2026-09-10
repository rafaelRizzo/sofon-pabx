import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { QueuesCache } from './cache/queues.cache'
import { QueueMembersCache } from '../queue-members/cache/queue-members.cache'
import type { CreateQueueInput, UpdateQueueInput } from './schemas/queue.schema'
import {
    AsteriskQueueRepository,
    toAsteriskQueueName
} from '../../asterisk/queue.repository'
import { CallcenterSurveyRepository } from '../../asterisk/callcenter-survey.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { syncFlowNodeLabel } from '../flows/flow-nodes.service'
import {
    validateRouteDestination,
    assertNotReferenced
} from '../../schemas/route-destination.validate'
import {
    resolveDestinationLabels,
    withDestinationLabel
} from '../../schemas/route-destination-label'
import {
    resolveUsedByLabels,
    type UsedByRef
} from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
import { audioSoundPath } from '../../asterisk/audio.repository'
import { AppError } from '../../utils/errors/app.error'
import { logger } from '../../utils/logger'

// Regenerar o dialplan (arquivo estático) é best-effort: se falhar aqui (disco, permissão, etc.),
// o registro já foi commitado no Postgres (fonte da verdade) - deixar a exceção subir faria a API
// responder erro sobre uma operação que na prática já foi persistida. O próximo CRUD dessa empresa
// regenera o arquivo do zero a partir do estado atual do banco, então a inconsistência se autocorrige.
const regenerateSafely = async (fn: () => Promise<void>, companyId: string) => {
    try {
        await fn()
    } catch (error) {
        logger.error({
            event: 'queue.dialplan.regenerate.failed',
            companyId,
            error: error instanceof Error ? error.message : String(error)
        })
    }
}

const queueSelect = {
    id: true,
    name: true,
    number: true,
    companyId: true,
    strategy: true,
    musicOnHold: true,
    timeout: true,
    retry: true,
    maxLen: true,
    wrapupTime: true,
    announce: true,
    announceFrequency: true,
    announcePosition: true,
    periodicAnnounce: true,
    periodicAnnounceFrequency: true,
    agentAnnounce: true,
    joinEmpty: true,
    leaveWhenEmpty: true,
    weight: true,
    metadata: true,
    surveyAudioId: true,
    surveyServiceAudioId: true,
    surveyThanksAudioId: true,
    callcenterEnabled: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { asteriskId: true } },
    _count: { select: { members: true } }
} as const

const toDto = <
    T extends {
        surveyAudioId: string | null
        surveyServiceAudioId: string | null
        usedBy: UsedByRef[]
    }
>(
    q: T
) => ({
    ...q,
    hasSurveyAudio: q.surveyAudioId !== null && q.surveyServiceAudioId !== null
})

const _byId = () => prisma.queue.findUnique({ where: { id: '' }, select: queueSelect })
type QueueRow = NonNullable<Awaited<ReturnType<typeof _byId>>> & { postQueueDestination: RouteDestination }

// Anexa o nome legível de postQueueDestination (resolvido no backend, cache-first - ver
// route-destination-label.ts). Agrupa por companyId - getAllQueues pode misturar empresas
// diferentes na mesma lista (visão admin).
async function withDestinationLabels<
    T extends { postQueueDestination: unknown; companyId: string }
>(queues: T[]): Promise<T[]> {
    if (queues.length === 0) return queues
    const byCompany = new Map<string, RouteDestination[]>()
    for (const q of queues) {
        const arr = byCompany.get(q.companyId) ?? []
        arr.push(q.postQueueDestination as RouteDestination)
        byCompany.set(q.companyId, arr)
    }
    const labelMaps = new Map(
        await Promise.all(
            [...byCompany.entries()].map(
                async ([companyId, dests]) =>
                    [
                        companyId,
                        await resolveDestinationLabels(dests, companyId)
                    ] as const
            )
        )
    )
    return queues.map((q) => ({
        ...q,
        postQueueDestination: withDestinationLabel(
            q.postQueueDestination as RouteDestination,
            labelMaps.get(q.companyId)!
        )
    }))
}

// Anexa o indicador "usado por" (resolveUsedByLabels, reverse lookup de FlowEdge). Agrupa por
// companyId pelo mesmo motivo de withDestinationLabels acima - getAllQueues mistura empresas.
async function withUsedBy<T extends { id: string; companyId: string }>(
    rows: T[]
): Promise<(T & { usedBy: UsedByRef[] })[]> {
    if (rows.length === 0) return []
    const byCompany = new Map<string, string[]>()
    for (const r of rows) {
        const arr = byCompany.get(r.companyId) ?? []
        arr.push(r.id)
        byCompany.set(r.companyId, arr)
    }
    const usedByMaps = await Promise.all(
        [...byCompany.entries()].map(([companyId, ids]) =>
            resolveUsedByLabels('queue', ids, companyId)
        )
    )
    const merged = new Map<string, UsedByRef[]>()
    for (const m of usedByMaps) for (const [id, refs] of m) merged.set(id, refs)
    return rows.map((r) => ({ ...r, usedBy: merged.get(r.id) ?? [] }))
}

export const getAllQueues = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    let rows: QueueRow[] | null = null
    if (!companyIds) rows = (await QueuesCache.getAll()) as QueueRow[] | null
    else if (userId) rows = (await QueuesCache.getForScope(userId)) as QueueRow[] | null

    if (!rows) {
        const qRows = await prisma.queue.findMany({
            where: companyIds ? { companyId: { in: companyIds } } : undefined,
            select: queueSelect
        })
        const edges = await FlowEdgeRepository.getBySourceIds(
            'queue',
            qRows.map((r) => r.id)
        )
        rows = qRows.map((r) => ({
            ...r,
            postQueueDestination: edges.get(r.id)?.default ?? null
        }))
        if (!companyIds) await QueuesCache.setAll(rows)
        else if (userId) await QueuesCache.setForScope(userId, rows)
    }

    const rowsWithUsedBy = await withUsedBy(rows)
    return withDestinationLabels(rowsWithUsedBy.map(toDto))
}

export const getQueuesByCompany = async (companyId: string) => {
    let rows = (await QueuesCache.getByCompany(companyId)) as QueueRow[] | null
    if (!rows) {
        await getCompanyById(companyId)

        const [qRows, edges] = await Promise.all([
            prisma.queue.findMany({ where: { companyId }, select: queueSelect }),
            FlowEdgeRepository.getBySource(companyId, 'queue')
        ])
        rows = qRows.map((r) => ({
            ...r,
            postQueueDestination: edges.get(r.id)?.default ?? null
        }))
        await QueuesCache.setByCompany(companyId, rows)
    }

    const usedByMap = await resolveUsedByLabels(
        'queue',
        rows.map((r) => r.id),
        companyId
    )
    return withDestinationLabels(
        rows.map((r) => toDto({ ...r, usedBy: usedByMap.get(r.id) ?? [] }))
    )
}

export type QueueDto = ReturnType<typeof toDto<QueueRow & { usedBy: UsedByRef[] }>>

export const getQueueById = async (id: string): Promise<QueueDto> => {
    let row = (await QueuesCache.getQueue(id)) as QueueRow | null
    if (!row) {
        const queue = await prisma.queue.findUnique({
            where: { id },
            select: queueSelect
        })
        if (!queue) throw new AppError('Queue not found', 404)

        const postQueueDestination = await FlowEdgeRepository.getOne('queue', id, 'default')
        row = { ...queue, postQueueDestination }
        await QueuesCache.setQueue(id, row)
    }

    const usedByMap = await resolveUsedByLabels('queue', [id], row.companyId)
    return (
        await withDestinationLabels([
            toDto({ ...row, usedBy: usedByMap.get(id) ?? [] })
        ])
    )[0]!
}

export const createQueue = async (data: CreateQueueInput) => {
    const company = await getCompanyById(data.companyId)

    const existing = await prisma.queue.findUnique({
        where: {
            name_companyId: { name: data.name, companyId: data.companyId }
        }
    })
    if (existing)
        throw new AppError('Queue already exists for this company', 409)

    const duplicateNumber = await prisma.queue.findUnique({
        where: {
            number_companyId: { number: data.number, companyId: data.companyId }
        }
    })
    if (duplicateNumber)
        throw new AppError('Queue number already in use for this company', 409)

    await validateRouteDestination(
        data.postQueueDestination ?? null,
        data.companyId,
        'postQueueDestination'
    )
    const hasSurveyAudio = (data.surveyAudioId ?? null) !== null
    const hasSurveyServiceAudio = (data.surveyServiceAudioId ?? null) !== null
    if (hasSurveyAudio !== hasSurveyServiceAudio)
        throw new AppError('Both survey audios (surveyAudioId and surveyServiceAudioId) are required together', 400)
    await assertAudioBelongsToCompany(data.surveyAudioId, data.companyId)
    await assertAudioBelongsToCompany(data.surveyServiceAudioId, data.companyId)
    await assertAudioBelongsToCompany(data.surveyThanksAudioId, data.companyId)
    await assertAudioBelongsToCompany(data.announce, data.companyId)
    await assertAudioBelongsToCompany(data.periodicAnnounce, data.companyId)
    await assertAudioBelongsToCompany(data.agentAnnounce, data.companyId)

    const asteriskName = toAsteriskQueueName(company.asteriskId, data.number)

    // App guarda o audioId (data.periodicAnnounce/agentAnnounce) - a tabela realtime do Asterisk
    // precisa do path absoluto do arquivo (ver AsteriskQueueRepository/audioSoundPath). `announce`
    // (join announcement, tocado ao caller uma única vez ao entrar) NÃO vai pra cá: vira um
    // Playback no dialplan (ver AsteriskQueueRepository.regenerate) - quem grava na coluna
    // realtime `announce` (nativa do Asterisk, tocada pro AGENTE antes do bridge) é agentAnnounce
    const asteriskData = {
        ...data,
        announce: data.agentAnnounce
            ? audioSoundPath(company.asteriskId, data.agentAnnounce)
            : null,
        periodicAnnounce: data.periodicAnnounce
            ? audioSoundPath(company.asteriskId, data.periodicAnnounce)
            : null
    }

    const { postQueueDestination, ...createData } = data
    const queue = await prisma.$transaction(async (tx) => {
        const q = await tx.queue.create({
            data: createData,
            select: queueSelect
        })
        await AsteriskQueueRepository.createQueue(
            tx,
            q.id,
            asteriskName,
            asteriskData
        )
        await FlowEdgeRepository.setSlot(
            tx,
            data.companyId,
            'queue',
            q.id,
            'default',
            postQueueDestination ?? null
        )
        return q
    })

    await regenerateSafely(
        () => AsteriskQueueRepository.regenerate(data.companyId),
        data.companyId
    )
    if (data.surveyAudioId && data.surveyServiceAudioId)
        await regenerateSafely(
            () => CallcenterSurveyRepository.regenerate(data.companyId),
            data.companyId
        )
    await QueuesCache.invalidateByCompany(data.companyId)
    await QueuesCache.invalidateNamespace()
    return toDto({
        ...queue,
        postQueueDestination: postQueueDestination ?? null,
        usedBy: []
    })
}

export const updateQueue = async (id: string, data: UpdateQueueInput) => {
    const existing = await prisma.queue.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } }
    })
    if (!existing) throw new AppError('Queue not found', 404)

    const nameChanged = data.name !== undefined && data.name !== existing.name
    const oldAsteriskName = toAsteriskQueueName(
        existing.company.asteriskId,
        existing.number
    )
    const newAsteriskName =
        data.number !== undefined
            ? toAsteriskQueueName(existing.company.asteriskId, data.number)
            : oldAsteriskName

    if (nameChanged) {
        const duplicate = await prisma.queue.findUnique({
            where: {
                name_companyId: {
                    name: data.name!,
                    companyId: existing.companyId
                }
            }
        })
        if (duplicate)
            throw new AppError(
                'Queue name already in use for this company',
                409
            )
    }

    if (data.number !== undefined && data.number !== existing.number) {
        const duplicate = await prisma.queue.findFirst({
            where: {
                number: data.number,
                companyId: existing.companyId,
                NOT: { id }
            }
        })
        if (duplicate)
            throw new AppError(
                'Queue number already in use for this company',
                409
            )
    }

    if (data.postQueueDestination !== undefined)
        await validateRouteDestination(
            data.postQueueDestination,
            existing.companyId,
            'postQueueDestination'
        )

    if (data.surveyAudioId !== undefined)
        await assertAudioBelongsToCompany(
            data.surveyAudioId,
            existing.companyId
        )
    if (data.surveyServiceAudioId !== undefined)
        await assertAudioBelongsToCompany(
            data.surveyServiceAudioId,
            existing.companyId
        )
    const finalSurveyAudioId =
        data.surveyAudioId !== undefined ? data.surveyAudioId : existing.surveyAudioId
    const finalSurveyServiceAudioId =
        data.surveyServiceAudioId !== undefined
            ? data.surveyServiceAudioId
            : existing.surveyServiceAudioId
    if ((finalSurveyAudioId !== null) !== (finalSurveyServiceAudioId !== null))
        throw new AppError('Both survey audios (surveyAudioId and surveyServiceAudioId) are required together', 400)
    if (data.surveyThanksAudioId !== undefined)
        await assertAudioBelongsToCompany(
            data.surveyThanksAudioId,
            existing.companyId
        )
    if (data.announce !== undefined)
        await assertAudioBelongsToCompany(data.announce, existing.companyId)
    if (data.periodicAnnounce !== undefined)
        await assertAudioBelongsToCompany(
            data.periodicAnnounce,
            existing.companyId
        )
    if (data.agentAnnounce !== undefined)
        await assertAudioBelongsToCompany(
            data.agentAnnounce,
            existing.companyId
        )

    const asteriskUpdate: Record<string, any> = {}
    if (data.strategy !== undefined) asteriskUpdate.strategy = data.strategy
    if (data.musicOnHold !== undefined)
        asteriskUpdate.musiconhold = data.musicOnHold
    if (data.timeout !== undefined) asteriskUpdate.timeout = data.timeout
    if (data.retry !== undefined) asteriskUpdate.retry = data.retry
    if (data.maxLen !== undefined) asteriskUpdate.maxlen = data.maxLen
    if (data.wrapupTime !== undefined)
        asteriskUpdate.wrapuptime = data.wrapupTime
    // `announce` (join announcement) não vai pra tabela realtime (ver comentário em createQueue) -
    // só dispara regenerate do dialplan via announceChanged, abaixo. Quem grava na coluna nativa
    // `announce` é agentAnnounce (agent announcement, tocado pro atendente antes do bridge)
    if (data.announceFrequency !== undefined)
        asteriskUpdate.announceFreq = data.announceFrequency
    if (data.announcePosition !== undefined)
        asteriskUpdate.announcePosition = data.announcePosition ? 'yes' : 'no'
    if (data.periodicAnnounce !== undefined)
        asteriskUpdate.periodicAnnounce = data.periodicAnnounce
            ? audioSoundPath(existing.company.asteriskId, data.periodicAnnounce)
            : null
    if (data.periodicAnnounceFrequency !== undefined)
        asteriskUpdate.periodicAnnounceFreq = data.periodicAnnounceFrequency
    if (data.agentAnnounce !== undefined)
        asteriskUpdate.announce = data.agentAnnounce
            ? audioSoundPath(existing.company.asteriskId, data.agentAnnounce)
            : null
    if (data.joinEmpty !== undefined)
        asteriskUpdate.joinempty = data.joinEmpty ? 'yes' : 'no'
    if (data.leaveWhenEmpty !== undefined)
        asteriskUpdate.leavewhenempty = data.leaveWhenEmpty ? 'yes' : 'no'
    if (data.weight !== undefined) asteriskUpdate.weight = data.weight

    const { name, number, postQueueDestination, ...appRest } = data
    const appUpdate: Record<string, any> = { ...appRest }
    if (name !== undefined) appUpdate.name = name
    if (number !== undefined) appUpdate.number = number

    const newNumber = data.number === undefined ? existing.number : data.number
    const numberChanged = newNumber !== existing.number
    const destChanged = data.postQueueDestination !== undefined
    const callcenterToggled =
        data.callcenterEnabled !== undefined &&
        data.callcenterEnabled !== existing.callcenterEnabled
    const announceChanged =
        data.announce !== undefined && data.announce !== existing.announce
    const needsResync =
        numberChanged || destChanged || callcenterToggled || announceChanged
    const surveyChanged =
        (data.surveyAudioId !== undefined &&
            data.surveyAudioId !== existing.surveyAudioId) ||
        (data.surveyServiceAudioId !== undefined &&
            data.surveyServiceAudioId !== existing.surveyServiceAudioId) ||
        (data.surveyThanksAudioId !== undefined &&
            data.surveyThanksAudioId !== existing.surveyThanksAudioId)

    const queue = await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.updateQueue(
            tx,
            existing.id,
            oldAsteriskName,
            newAsteriskName,
            asteriskUpdate
        )
        if (postQueueDestination !== undefined)
            await FlowEdgeRepository.setSlot(
                tx,
                existing.companyId,
                'queue',
                id,
                'default',
                postQueueDestination
            )

        return tx.queue.update({
            where: { id },
            data: appUpdate,
            select: queueSelect
        })
    })

    if (nameChanged) await syncFlowNodeLabel('queue', id, data.name!)

    if (needsResync)
        await regenerateSafely(
            () => AsteriskQueueRepository.regenerate(existing.companyId),
            existing.companyId
        )
    if (surveyChanged)
        await regenerateSafely(
            () => CallcenterSurveyRepository.regenerate(existing.companyId),
            existing.companyId
        )
    await QueuesCache.invalidateQueue(id)
    await QueuesCache.invalidateByCompany(existing.companyId)
    await QueuesCache.invalidateNamespace()
    const [resolvedDestination, usedByMap] = await Promise.all([
        postQueueDestination !== undefined
            ? postQueueDestination
            : FlowEdgeRepository.getOne('queue', id, 'default'),
        resolveUsedByLabels('queue', [id], existing.companyId)
    ])
    return toDto({
        ...queue,
        postQueueDestination: resolvedDestination,
        usedBy: usedByMap.get(id) ?? []
    })
}

export const deleteQueue = async (id: string) => {
    const existing = await prisma.queue.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } }
    })
    if (!existing) throw new AppError('Queue not found', 404)

    await assertNotReferenced('queue', id)

    const asteriskName = toAsteriskQueueName(
        existing.company.asteriskId,
        existing.number
    )

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.deleteQueue(tx, existing.id, asteriskName)
        await tx.queue.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'queue', id)
    })

    await regenerateSafely(
        () => AsteriskQueueRepository.regenerate(existing.companyId),
        existing.companyId
    )
    if (existing.surveyAudioId || existing.surveyServiceAudioId)
        await regenerateSafely(
            () => CallcenterSurveyRepository.regenerate(existing.companyId),
            existing.companyId
        )
    await QueuesCache.invalidateQueue(id)
    await QueueMembersCache.invalidateMembers(id)
    await QueuesCache.invalidateByCompany(existing.companyId)
    await QueuesCache.invalidateNamespace()
}
