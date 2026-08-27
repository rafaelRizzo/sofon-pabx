import { readFile } from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { audioSoundPath } from '../../asterisk/audio.repository'
import { AppError } from '../../utils/errors/app.error'
import { FLOW_EXPORT_KIND, FLOW_EXPORT_VERSION } from './schemas/flow-export.schema'

const MAX_NESTED_FLOW_DEPTH = 20

async function exportAudioRef(audioId: string | null | undefined, asteriskId: string) {
    if (!audioId) return null
    const audio = await prisma.audio.findUnique({ where: { id: audioId }, select: { name: true } })
    if (!audio) return null
    const wavBase64 = await readFile(`${audioSoundPath(asteriskId, audioId)}.wav`)
        .then((buf) => buf.toString('base64'))
        .catch(() => null) // arquivo pode ter sido removido do disco fora do fluxo normal
    if (!wavBase64) return null
    return { name: audio.name, wavBase64 }
}

async function exportQueueResource(resourceId: string, asteriskId: string) {
    const q = await prisma.queue.findUnique({ where: { id: resourceId } })
    if (!q) return null
    return {
        name: q.name,
        number: q.number,
        strategy: q.strategy,
        musicOnHold: q.musicOnHold,
        timeout: q.timeout,
        retry: q.retry,
        maxLen: q.maxLen,
        wrapupTime: q.wrapupTime,
        announceFrequency: q.announceFrequency,
        announcePosition: q.announcePosition,
        periodicAnnounceFrequency: q.periodicAnnounceFrequency,
        joinEmpty: q.joinEmpty,
        leaveWhenEmpty: q.leaveWhenEmpty,
        weight: q.weight,
        callcenterEnabled: q.callcenterEnabled,
        announceAudio: await exportAudioRef(q.announce, asteriskId),
        periodicAnnounceAudio: await exportAudioRef(q.periodicAnnounce, asteriskId),
        agentAnnounceAudio: await exportAudioRef(q.agentAnnounce, asteriskId),
        surveyAudio: await exportAudioRef(q.surveyAudioId, asteriskId)
    }
}

async function exportIvrResource(resourceId: string, asteriskId: string) {
    const ivr = await prisma.ivrMenu.findUnique({ where: { id: resourceId }, include: { options: true } })
    if (!ivr) return null
    return {
        name: ivr.name,
        type: ivr.type,
        variableName: ivr.variableName ?? undefined,
        maxDigits: ivr.maxDigits,
        digitTimeout: ivr.digitTimeout,
        invalidRetries: ivr.invalidRetries,
        timeoutRetries: ivr.timeoutRetries,
        options: ivr.options.map((o) => ({ digit: o.digit })),
        audio: await exportAudioRef(ivr.audioId, asteriskId)
    }
}

async function exportAnnouncementResource(resourceId: string, asteriskId: string) {
    const a = await prisma.announcement.findUnique({ where: { id: resourceId } })
    if (!a) return null
    return { name: a.name, audio: await exportAudioRef(a.audioId, asteriskId) }
}

async function exportRequestResource(resourceId: string) {
    const r = await prisma.requestTemplate.findUnique({ where: { id: resourceId } })
    if (!r) return null
    return { name: r.name, method: r.method, url: r.url, headers: r.headers, body: r.body, timeoutMs: r.timeoutMs, variableMappings: r.variableMappings }
}

async function exportVariableSetResource(resourceId: string) {
    const v = await prisma.variableSet.findUnique({ where: { id: resourceId } })
    if (!v) return null
    return { name: v.name, assignments: v.assignments }
}

async function exportVariableConditionResource(resourceId: string) {
    const v = await prisma.variableCondition.findUnique({ where: { id: resourceId } })
    if (!v) return null
    return { name: v.name, combinator: v.combinator, rules: v.rules }
}

async function exportTimeConditionResource(resourceId: string) {
    const tc = await prisma.timeCondition.findUnique({
        where: { id: resourceId },
        include: { timeGroups: { include: { timeGroup: { include: { ranges: true } } } } }
    })
    if (!tc) return null
    return {
        name: tc.name,
        // `id` original de cada TimeGroup viaja só pra deduplicar grupos compartilhados por mais
        // de um nó de timecondition dentro do mesmo flow (ver flow-import.service.ts)
        groups: tc.timeGroups.map(({ timeGroup: tg }) => ({
            id: tg.id,
            name: tg.name,
            ranges: tg.ranges.map((r) => ({ startTime: r.startTime, endTime: r.endTime, weekdays: r.weekdays, monthdays: r.monthdays, months: r.months }))
        }))
    }
}

async function exportHolidayResource(resourceId: string) {
    const hg = await prisma.holidayGroup.findUnique({ where: { id: resourceId }, include: { dates: true } })
    if (!hg) return null
    return {
        name: hg.name,
        url: hg.url ?? undefined,
        dates: hg.url ? undefined : hg.dates.map((d) => ({ name: d.name, month: d.month, day: d.day }))
    }
}

// credencial NUNCA é exportada (nem id, nem token) - só um hint pro import sugerir/exigir a
// escolha de uma IntegrationCredential já existente na empresa de destino
async function exportIxcResource(resourceId: string) {
    const n = await prisma.ixcNode.findUnique({ where: { id: resourceId } })
    if (!n) return null
    const credential = await prisma.integrationCredential.findUnique({ where: { id: n.credentialId }, select: { provider: true, name: true } })
    return {
        name: n.name,
        action: n.action,
        params: n.params,
        timeoutMs: n.timeoutMs,
        variableMappings: n.variableMappings,
        requiresCredential: credential ? { provider: credential.provider, name: credential.name } : null
    }
}

async function exportExtensionHint(resourceId: string) {
    const e = await prisma.extension.findUnique({ where: { id: resourceId }, select: { alias: true, name: true } })
    return e ? `${e.alias} - ${e.name}` : null
}

async function exportFlowBundleRecursive(flowId: string, companyId: string, asteriskId: string, depth: number): Promise<Record<string, unknown>> {
    if (depth > MAX_NESTED_FLOW_DEPTH) throw new AppError('Profundidade máxima de flows aninhados excedida', 400)

    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { id: true, name: true, companyId: true, entryNodeId: true } })
    if (!flow) throw new AppError('Flow not found', 404)
    if (flow.companyId !== companyId) throw new AppError('Flow belongs to different company', 403)

    const [nodes, edges] = await Promise.all([
        prisma.flowNode.findMany({ where: { flowId } }),
        prisma.flowNodeEdge.findMany({ where: { flowId } })
    ])

    const exportedNodes = []
    for (const n of nodes) {
        const base = { id: n.id, type: n.type, label: n.label, position: n.position }
        switch (n.type) {
            case 'voicemail':
                exportedNodes.push({ ...base, resourceId: n.resourceId })
                break
            case 'hangup':
                exportedNodes.push(base)
                break
            case 'extension':
                exportedNodes.push({ ...base, requiresMapping: true, hint: n.resourceId ? await exportExtensionHint(n.resourceId) : null })
                break
            case 'queue':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportQueueResource(n.resourceId, asteriskId) : null })
                break
            case 'ivr':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportIvrResource(n.resourceId, asteriskId) : null })
                break
            case 'announcement':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportAnnouncementResource(n.resourceId, asteriskId) : null })
                break
            case 'request':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportRequestResource(n.resourceId) : null })
                break
            case 'variable-set':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportVariableSetResource(n.resourceId) : null })
                break
            case 'variable-condition':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportVariableConditionResource(n.resourceId) : null })
                break
            case 'timecondition':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportTimeConditionResource(n.resourceId) : null })
                break
            case 'holiday':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportHolidayResource(n.resourceId) : null })
                break
            case 'ixc':
                exportedNodes.push({ ...base, resource: n.resourceId ? await exportIxcResource(n.resourceId) : null })
                break
            case 'flow':
                exportedNodes.push({
                    ...base,
                    nestedFlow: n.resourceId ? await exportFlowBundleRecursive(n.resourceId, companyId, asteriskId, depth + 1) : null
                })
                break
            default:
                exportedNodes.push(base)
        }
    }

    return {
        id: flow.id,
        name: flow.name,
        entryNodeId: flow.entryNodeId,
        nodes: exportedNodes,
        edges: edges.map((e) => ({ sourceNodeId: e.sourceNodeId, sourcePort: e.sourcePort, targetNodeId: e.targetNodeId }))
    }
}

export async function exportFlow(flowId: string, companyId: string) {
    const company = await getCompanyById(companyId)
    const flow = await exportFlowBundleRecursive(flowId, companyId, company.asteriskId, 0)
    return { kind: FLOW_EXPORT_KIND, version: FLOW_EXPORT_VERSION, flow }
}
