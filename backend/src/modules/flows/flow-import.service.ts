import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import { createAudio, deleteAudio } from '../audios/audios.service'
import { createQueue, deleteQueue } from '../queues/queues.service'
import { createQueueSchema } from '../queues/schemas/queue.schema'
import { createIvrMenu, deleteIvrMenu } from '../ivr/ivr.service'
import { createIvrMenuSchema } from '../ivr/schemas/ivr.schema'
import { createAnnouncement, deleteAnnouncement } from '../announcements/announcements.service'
import { createAnnouncementSchema } from '../announcements/schemas/announcement.schema'
import { createRequestTemplate, deleteRequestTemplate } from '../request-templates/request-templates.service'
import { createRequestTemplateSchema } from '../request-templates/schemas/request-template.schema'
import { createVariableSet, deleteVariableSet } from '../variables/variables.service'
import { createVariableSetSchema } from '../variables/schemas/variable.schema'
import { createVariableCondition, deleteVariableCondition } from '../variable-conditions/variable-conditions.service'
import { createVariableConditionSchema } from '../variable-conditions/schemas/variable-condition.schema'
import { createTimeGroup, deleteTimeGroup } from '../time-groups/time-groups.service'
import { createTimeGroupSchema } from '../time-groups/schemas/time-group.schema'
import { createTimeCondition, deleteTimeCondition } from '../time-conditions/time-conditions.service'
import { createTimeConditionSchema } from '../time-conditions/schemas/time-condition.schema'
import { createHolidayGroup, deleteHolidayGroup } from '../holiday-groups/holiday-groups.service'
import { createHolidayGroupSchema } from '../holiday-groups/schemas/holiday-group.schema'
import { createIxcNode, deleteIxcNode } from '../ixc-nodes/ixc-nodes.service'
import { createIxcNodeSchema } from '../ixc-nodes/schemas/ixc-node.schema'
import { createFlow, deleteFlow } from './flows.service'
import { createFlowNode, batchFlowNodeEdges, updateFlowNode, type FlowNodeType } from './flow-nodes.service'
import { FLOW_EXPORT_KIND, FLOW_EXPORT_VERSION } from './schemas/flow-export.schema'

type Raw = Record<string, any>
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v : [])

export type FlowImportResolutions = {
    extensions?: Record<string, string>
    credentials?: Record<string, string>
}

function assertBundle(bundle: Raw): Raw {
    if (bundle?.kind !== FLOW_EXPORT_KIND || bundle?.version !== FLOW_EXPORT_VERSION || !bundle?.flow)
        throw new AppError('Arquivo de export de flow inválido ou de versão incompatível', 400)
    return bundle.flow as Raw
}

// ─── Preview — não persiste nada, só lista o que precisa de resolução manual antes do import ────

type PendingExtension = { nodeId: string; label: string | null; hint: string | null; flowName: string }
type PendingCredential = { nodeId: string; label: string | null; provider: string; nameHint: string; flowName: string }

function collectPending(flow: Raw, extensions: PendingExtension[], credentials: PendingCredential[]) {
    for (const n of arr(flow.nodes)) {
        if (n.type === 'extension') extensions.push({ nodeId: n.id, label: n.label ?? null, hint: n.hint ?? null, flowName: flow.name })
        if (n.type === 'ixc' && n.resource?.requiresCredential)
            credentials.push({
                nodeId: n.id,
                label: n.label ?? null,
                provider: n.resource.requiresCredential.provider,
                nameHint: n.resource.requiresCredential.name,
                flowName: flow.name
            })
        if (n.type === 'flow' && n.nestedFlow) collectPending(n.nestedFlow, extensions, credentials)
    }
}

export async function previewFlowImport(bundle: Raw, companyId: string) {
    const flow = assertBundle(bundle)
    const pendingExtensions: PendingExtension[] = []
    const pendingCredentials: PendingCredential[] = []
    collectPending(flow, pendingExtensions, pendingCredentials)

    const providers = [...new Set(pendingCredentials.map((c) => c.provider))]
    const [availableExtensions, availableCredentials] = await Promise.all([
        pendingExtensions.length
            ? prisma.extension.findMany({ where: { companyId }, select: { id: true, alias: true, name: true }, orderBy: { alias: 'asc' } })
            : [],
        providers.length
            ? prisma.integrationCredential.findMany({ where: { companyId, provider: { in: providers } }, select: { id: true, provider: true, name: true } })
            : []
    ])

    return { flowName: flow.name as string, pendingExtensions, pendingCredentials, availableExtensions, availableCredentials }
}

// ─── Import ───────────────────────────────────────────────────────────────────────────────────
// Sem transaction de banco (cada módulo tem seu próprio create/delete, não um client tx
// compartilhado — mesmo motivo do backup/restore.ts). Em caso de erro no meio do caminho, desfaz
// em ordem reversa tudo que já foi criado nesta chamada (best effort) e propaga o erro original.

// Reimportar o mesmo export (ou importar um flow que colide com recurso já existente na empresa
// destino, inclusive de outra empresa) não pode falhar com 409 cru — soma "(cópia)"/"(cópia N)" até
// achar um nome livre. Usado por todo recurso do flow com constraint @@unique([name, companyId])
async function resolveUniqueName(
    model: { findMany: (args: { where: { companyId: string }; select: { name: true } }) => Promise<{ name: string }[]> },
    name: string,
    companyId: string
): Promise<string> {
    const existing = await model.findMany({ where: { companyId }, select: { name: true } })
    const names = new Set(existing.map((r) => r.name))
    if (!names.has(name)) return name

    let candidate = `${name} (cópia)`
    let i = 2
    while (names.has(candidate)) candidate = `${name} (cópia ${i++})`
    return candidate
}

// Queue.number só aceita dígitos (regex do schema) — não dá pra sufixar "(cópia)"; incrementa até
// achar um número livre na empresa destino
async function resolveUniqueQueueNumber(number: string, companyId: string): Promise<string> {
    const existing = await prisma.queue.findMany({ where: { companyId }, select: { number: true } })
    const numbers = new Set(existing.map((q) => q.number))
    if (!numbers.has(number)) return number

    let candidate = Number(number)
    do {
        candidate++
    } while (numbers.has(String(candidate)))
    return String(candidate)
}

async function importAudioIfAny(ref: Raw | null | undefined, companyId: string, undo: Array<() => Promise<void>>): Promise<string | undefined> {
    if (!ref?.wavBase64) return undefined
    const name = await resolveUniqueName(prisma.audio, ref.name, companyId)
    const created = await createAudio(companyId, name, Buffer.from(ref.wavBase64, 'base64'), 'flow-import.wav')
    undo.push(() => deleteAudio(created.id).then(() => undefined))
    return created.id
}

async function importFlowRecursive(
    flow: Raw,
    companyId: string,
    resolutions: FlowImportResolutions,
    flowIdByOriginal: Map<string, string>,
    timeGroupIdByOriginal: Map<string, string>,
    undo: Array<() => Promise<void>>
): Promise<string> {
    const existingFlowId = flowIdByOriginal.get(flow.id)
    if (existingFlowId) return existingFlowId

    const resourceIdByNode = new Map<string, string | null>()

    for (const n of arr(flow.nodes)) {
        const label = n.label ?? n.id
        switch (n.type) {
            case 'hangup':
                resourceIdByNode.set(n.id, null)
                break

            case 'voicemail':
                resourceIdByNode.set(n.id, n.resourceId ?? null)
                break

            case 'extension': {
                const extensionId = resolutions.extensions?.[n.id]
                if (!extensionId) throw new AppError(`Nó "${n.hint ?? label}" (ramal) precisa de um ramal selecionado antes de importar`, 400)
                const ext = await prisma.extension.findUnique({ where: { id: extensionId }, select: { companyId: true } })
                if (!ext || ext.companyId !== companyId) throw new AppError('Ramal selecionado é inválido para esta empresa', 400)
                resourceIdByNode.set(n.id, extensionId)
                break
            }

            case 'queue': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (fila) está sem configuração no arquivo de export`, 400)
                const created = await createQueue(
                    createQueueSchema.parse({
                        name: await resolveUniqueName(prisma.queue, r.name, companyId),
                        number: await resolveUniqueQueueNumber(r.number, companyId),
                        companyId,
                        strategy: r.strategy,
                        musicOnHold: r.musicOnHold,
                        timeout: r.timeout,
                        retry: r.retry,
                        maxLen: r.maxLen,
                        wrapupTime: r.wrapupTime,
                        announce: await importAudioIfAny(r.announceAudio, companyId, undo),
                        announceFrequency: r.announceFrequency,
                        announcePosition: r.announcePosition,
                        periodicAnnounce: await importAudioIfAny(r.periodicAnnounceAudio, companyId, undo),
                        periodicAnnounceFrequency: r.periodicAnnounceFrequency,
                        agentAnnounce: await importAudioIfAny(r.agentAnnounceAudio, companyId, undo),
                        joinEmpty: r.joinEmpty,
                        leaveWhenEmpty: r.leaveWhenEmpty,
                        weight: r.weight,
                        surveyAudioId: await importAudioIfAny(r.surveyAudio, companyId, undo),
                        callcenterEnabled: r.callcenterEnabled
                    })
                )
                undo.push(() => deleteQueue(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'ivr': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (IVR) está sem configuração no arquivo de export`, 400)
                const created = await createIvrMenu(
                    createIvrMenuSchema.parse({
                        name: await resolveUniqueName(prisma.ivrMenu, r.name, companyId),
                        companyId,
                        type: r.type,
                        variableName: r.variableName ?? undefined,
                        audioId: await importAudioIfAny(r.audio, companyId, undo),
                        maxDigits: r.maxDigits,
                        digitTimeout: r.digitTimeout,
                        invalidRetries: r.invalidRetries,
                        timeoutRetries: r.timeoutRetries,
                        options: arr(r.options).map((o) => ({ digit: o.digit }))
                    })
                )
                undo.push(() => deleteIvrMenu(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'announcement': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (anúncio) está sem configuração no arquivo de export`, 400)
                const created = await createAnnouncement(
                    createAnnouncementSchema.parse({
                        name: await resolveUniqueName(prisma.announcement, r.name, companyId),
                        companyId,
                        audioId: await importAudioIfAny(r.audio, companyId, undo)
                    })
                )
                undo.push(() => deleteAnnouncement(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'request': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (request) está sem configuração no arquivo de export`, 400)
                const created = await createRequestTemplate(
                    createRequestTemplateSchema.parse({
                        name: await resolveUniqueName(prisma.requestTemplate, r.name, companyId),
                        companyId,
                        method: r.method,
                        url: r.url,
                        headers: r.headers ?? undefined,
                        body: r.body ?? undefined,
                        timeoutMs: r.timeoutMs,
                        variableMappings: r.variableMappings ?? []
                    })
                )
                undo.push(() => deleteRequestTemplate(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'variable-set': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (setar variável) está sem configuração no arquivo de export`, 400)
                const created = await createVariableSet(
                    createVariableSetSchema.parse({
                        name: await resolveUniqueName(prisma.variableSet, r.name, companyId),
                        companyId,
                        assignments: arr(r.assignments)
                    })
                )
                undo.push(() => deleteVariableSet(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'variable-condition': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (condição de variável) está sem configuração no arquivo de export`, 400)
                const created = await createVariableCondition(
                    createVariableConditionSchema.parse({
                        name: await resolveUniqueName(prisma.variableCondition, r.name, companyId),
                        companyId,
                        combinator: r.combinator,
                        rules: arr(r.rules)
                    })
                )
                undo.push(() => deleteVariableCondition(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'timecondition': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (condição de horário) está sem configuração no arquivo de export`, 400)
                const groupIds: string[] = []
                for (const g of arr(r.groups)) {
                    let newGroupId = timeGroupIdByOriginal.get(g.id)
                    if (!newGroupId) {
                        const createdGroup = await createTimeGroup(
                            createTimeGroupSchema.parse({
                                name: await resolveUniqueName(prisma.timeGroup, g.name, companyId),
                                companyId,
                                ranges: arr(g.ranges).map((rg) => ({
                                    startTime: rg.startTime,
                                    endTime: rg.endTime,
                                    weekdays: rg.weekdays,
                                    monthdays: rg.monthdays,
                                    months: rg.months
                                }))
                            })
                        )
                        undo.push(() => deleteTimeGroup(createdGroup.id))
                        newGroupId = createdGroup.id
                        timeGroupIdByOriginal.set(g.id, newGroupId)
                    }
                    groupIds.push(newGroupId)
                }
                const created = await createTimeCondition(
                    createTimeConditionSchema.parse({
                        name: await resolveUniqueName(prisma.timeCondition, r.name, companyId),
                        companyId,
                        groupIds
                    })
                )
                undo.push(() => deleteTimeCondition(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'holiday': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (feriados) está sem configuração no arquivo de export`, 400)
                const created = await createHolidayGroup(
                    createHolidayGroupSchema.parse({
                        name: await resolveUniqueName(prisma.holidayGroup, r.name, companyId),
                        companyId,
                        url: r.url ?? undefined,
                        dates: r.url ? undefined : arr(r.dates).map((d) => ({ name: d.name, month: d.month, day: d.day }))
                    })
                )
                undo.push(() => deleteHolidayGroup(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'ixc': {
                const r = n.resource
                if (!r) throw new AppError(`Nó "${label}" (IXC) está sem configuração no arquivo de export`, 400)
                const credentialId = resolutions.credentials?.[n.id]
                if (!credentialId) throw new AppError(`Nó "${label}" (IXC) precisa de uma credencial selecionada antes de importar`, 400)
                const credential = await prisma.integrationCredential.findUnique({ where: { id: credentialId }, select: { companyId: true } })
                if (!credential || credential.companyId !== companyId) throw new AppError('Credencial selecionada é inválida para esta empresa', 400)
                const created = await createIxcNode(
                    createIxcNodeSchema.parse({
                        name: await resolveUniqueName(prisma.ixcNode, r.name, companyId),
                        companyId,
                        credentialId,
                        action: r.action,
                        params: r.params ?? undefined,
                        timeoutMs: r.timeoutMs,
                        variableMappings: r.variableMappings ?? []
                    })
                )
                undo.push(() => deleteIxcNode(created.id))
                resourceIdByNode.set(n.id, created.id)
                break
            }

            case 'flow': {
                if (!n.nestedFlow) throw new AppError(`Nó "${label}" (flow aninhado) está sem configuração no arquivo de export`, 400)
                const nestedId = await importFlowRecursive(n.nestedFlow, companyId, resolutions, flowIdByOriginal, timeGroupIdByOriginal, undo)
                resourceIdByNode.set(n.id, nestedId)
                break
            }

            default:
                resourceIdByNode.set(n.id, null)
        }
    }

    const createdFlow = await createFlow({ name: await resolveUniqueName(prisma.flow, flow.name, companyId), companyId })
    undo.push(() => deleteFlow(createdFlow.id))
    flowIdByOriginal.set(flow.id, createdFlow.id)

    const newNodeIdByOriginal = new Map<string, string>()
    for (const n of arr(flow.nodes)) {
        const createdNode = await createFlowNode(createdFlow.id, {
            type: n.type as FlowNodeType,
            resourceId: resourceIdByNode.get(n.id) ?? null,
            label: n.label ?? undefined,
            position: n.position
        })
        newNodeIdByOriginal.set(n.id, createdNode.id)
    }

    const edges = arr(flow.edges)
    if (edges.length > 0) {
        await batchFlowNodeEdges(
            createdFlow.id,
            edges.map((e) => {
                const sourceNodeId = newNodeIdByOriginal.get(e.sourceNodeId)
                const targetNodeId = newNodeIdByOriginal.get(e.targetNodeId)
                if (!sourceNodeId || !targetNodeId) throw new AppError(`Aresta do flow "${flow.name}" referencia nó inexistente no arquivo de export`, 400)
                return { type: 'connect' as const, sourceNodeId, sourcePort: e.sourcePort, targetNodeId }
            })
        )
    }

    if (flow.entryNodeId) {
        const entryId = newNodeIdByOriginal.get(flow.entryNodeId)
        if (entryId) await updateFlowNode(createdFlow.id, entryId, { isEntry: true })
    }

    return createdFlow.id
}

export async function importFlow(bundle: Raw, resolutions: FlowImportResolutions | undefined, companyId: string) {
    const flow = assertBundle(bundle)
    const undo: Array<() => Promise<void>> = []
    try {
        const flowId = await importFlowRecursive(flow, companyId, resolutions ?? {}, new Map(), new Map(), undo)
        return { flowId }
    } catch (error) {
        for (const rollback of undo.reverse()) await rollback().catch(() => {})
        throw error
    }
}
