import { prisma } from '../../lib/prisma'
import { audioSoundPath } from '../destinations/audio.repository'
import { buildDialplan as buildIvrDialplan } from '../destinations/ivr.repository'
import {
    ANNOUNCEMENT_CONTEXT, FLOW_CONTEXT, FLOW_NODE_CONTEXT, HOL_CONTEXT,
    REQUEST_TEMPLATE_CONTEXT, TC_CONTEXT, VARCOND_CONTEXT, VAR_CONTEXT, IXC_NODE_CONTEXT, FORMATTER_CONTEXT,
    flowExten, flowNodeExten, flowNodeExitExten, announcementExten, holEntry, requestTemplateExten,
    tcEntry, varCondEntry, varEntry, ixcNodeExten, formatterExten,
} from '../dialplan/dialplan-names'
import { FLOW_NODE_ID_VAR, nodeExitTarget } from './flow-node-runtime'
import { QUEUE_APP_CONTEXT, queueAppExten } from '../destinations/queue.repository'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

export { FLOW_NODE_CONTEXT, flowNodeExten }

type NodeRow = { id: string; flowId: string; type: string; resourceId: string | null }
type EdgeRow = { sourceNodeId: string; sourcePort: string; targetNodeId: string }

const staticPorts: Record<string, string[]> = {
    queue: ['default'],
    announcement: ['default'],
    timecondition: ['true', 'false'],
    holiday: ['true', 'false'],
    request: ['success', 'error'],
    ixc: ['success', 'error'],
    formatter: ['success', 'error'],
    'variable-set': ['default'],
    'variable-condition': ['true', 'false'],
}

function targetFor(edge: EdgeRow | undefined): DialplanRow['appdata'] {
    return edge ? `${FLOW_NODE_CONTEXT},${flowNodeExten(edge.targetNodeId)},1` : null
}

async function buildResourceEntry(node: NodeRow, asteriskId: string): Promise<DialplanRow[]> {
    const exten = flowNodeExten(node.id)
    const setNode = (): DialplanRow => ({ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Set', appdata: `__${FLOW_NODE_ID_VAR}=${node.id}` })
    const go = (context: string, target: string): DialplanRow[] => [
        setNode(),
        { context: FLOW_NODE_CONTEXT, exten, priority: 2, app: 'Goto', appdata: `${context},${target},1` },
    ]

    if (node.type === 'hangup') return [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]
    if (!node.resourceId) return [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]

    switch (node.type) {
        case 'extension': {
            const resource = await prisma.extension.findUnique({ where: { id: node.resourceId }, select: { context: true, number: true } })
            return resource ? go(resource.context, resource.number) : [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]
        }
        case 'queue': {
            const resource = await prisma.queue.findUnique({ where: { id: node.resourceId }, select: { number: true } })
            return resource ? go(QUEUE_APP_CONTEXT, queueAppExten(asteriskId, resource.number)) : [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]
        }
        case 'announcement': return go(ANNOUNCEMENT_CONTEXT, announcementExten(node.resourceId))
        case 'timecondition': return go(TC_CONTEXT, tcEntry(node.resourceId))
        case 'holiday': return go(HOL_CONTEXT, holEntry(node.resourceId))
        case 'request': return go(REQUEST_TEMPLATE_CONTEXT, requestTemplateExten(node.resourceId))
        case 'ixc': return go(IXC_NODE_CONTEXT, ixcNodeExten(node.resourceId))
        case 'formatter': return go(FORMATTER_CONTEXT, formatterExten(node.resourceId))
        case 'variable-set': return go(VAR_CONTEXT, varEntry(node.resourceId))
        case 'variable-condition': return go(VARCOND_CONTEXT, varCondEntry(node.resourceId))
        case 'flow': return go(FLOW_CONTEXT, flowExten(node.resourceId))
        case 'voicemail': return go('vm', node.resourceId)
        case 'ivr': {
            const resource = await prisma.ivrMenu.findUnique({
                where: { id: node.resourceId },
                include: { options: { orderBy: { digit: 'asc' } } },
            })
            if (!resource?.audioId) return [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]
            // URA é compilada no próprio nó: cada dígito/timeout pode ter uma saída diferente mesmo
            // quando o mesmo IvrMenu é reutilizado em outros flows.
            return buildIvrDialplan(
                node.id,
                {
                    name: resource.name,
                    soundPath: audioSoundPath(asteriskId, resource.audioId),
                    maxDigits: resource.maxDigits,
                    digitTimeout: resource.digitTimeout,
                    invalidRetries: resource.invalidRetries,
                    timeoutRetries: resource.timeoutRetries,
                    variableName: resource.variableName,
                },
                resource.options.map((option) => ({ digit: option.digit, target: nodeExitTarget(node.id, `digit:${option.digit}`) })),
                nodeExitTarget(node.id, 'invalid'),
                nodeExitTarget(node.id, 'timeout'),
                nodeExitTarget(node.id, 'long'),
                { context: FLOW_NODE_CONTEXT, exten },
            )
        }
        default:
            return [{ context: FLOW_NODE_CONTEXT, exten, priority: 1, app: 'Hangup', appdata: null }]
    }
}

export const FlowNodeRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${FLOW_NODE_CONTEXT}:${asteriskId}`, async () => {
            const [nodes, edges] = await Promise.all([
                prisma.flowNode.findMany({ where: { flow: { companyId } }, select: { id: true, flowId: true, type: true, resourceId: true } }),
                prisma.flowNodeEdge.findMany({ where: { flow: { companyId } }, select: { sourceNodeId: true, sourcePort: true, targetNodeId: true } }),
            ])
            const bySource = new Map(edges.map((edge) => [`${edge.sourceNodeId}:${edge.sourcePort}`, edge] as const))
            const entries: DialplanRow[] = []

            for (const node of nodes as NodeRow[]) {
                entries.push(...await buildResourceEntry(node, asteriskId))
                const ports = new Set([...(staticPorts[node.type] ?? []), ...edges.filter((edge) => edge.sourceNodeId === node.id).map((edge) => edge.sourcePort)])
                if (node.type === 'ivr') {
                    const menu = node.resourceId
                        ? await prisma.ivrMenu.findUnique({
                            where: { id: node.resourceId },
                            select: { type: true, options: { select: { digit: true } } },
                        })
                        : null
                    for (const option of menu?.options ?? []) ports.add(`digit:${option.digit}`)
                    ports.add('invalid'); ports.add('timeout')
                    if (menu?.type === 'collect') ports.add('long')
                }
                for (const port of ports) {
                    const target = targetFor(bySource.get(`${node.id}:${port}`))
                    entries.push({ context: FLOW_NODE_CONTEXT, exten: flowNodeExitExten(node.id, port), priority: 1, app: target ? 'Goto' : 'Hangup', appdata: target })
                }
            }
            await writeContextFile(FLOW_NODE_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
