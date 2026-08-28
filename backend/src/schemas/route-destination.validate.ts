import { prisma } from '../lib/prisma'
import { AppError } from '../utils/errors/app.error'
import { getExtensionDto } from '../modules/extensions/extensions.service'
import { FlowEdgeRepository } from '../asterisk/flow-edge.repository'
import type { RouteDestination } from './route-destination.schema'

type RouteDestType = Exclude<RouteDestination, null>['type']

// Nome legível de cada sourceType - usado só na mensagem de erro do guard de delete abaixo.
const SOURCE_LABELS: Record<string, string> = {
    inboundroute: 'Inbound route',
    timecondition: 'Time condition',
    holidaygroup: 'Holiday group',
    announcement: 'Announcement',
    ivrmenu: 'IVR menu',
    ivroption: 'IVR option',
    requesttemplate: 'Request template',
    ixcnode: 'IXC node',
    formatternode: 'Formatter',
    variableset: 'Variable set',
    variablecondition: 'Variable condition',
    queue: 'Queue',
    flow: 'Flow'
}

// Validação de existência/posse compartilhada por Inbound Routes e Time Conditions
// (trueRoute/falseRoute) - mesmo destino, mesmas regras, um lugar só.
// label prefixa a mensagem (ex: "trueRoute: ") quando o caller tem mais de um campo de destino.
export async function validateRouteDestination(
    dest: RouteDestination,
    companyId: string,
    label?: string
) {
    if (!dest || dest.type === 'hangup') return
    const prefix = label ? `${label}: ` : ''

    switch (dest.type) {
        case 'extension': {
            const ext = await getExtensionDto(dest.id).catch(() => {
                throw new AppError(`${prefix}Extension not found`, 404)
            })
            if (ext.companyId !== companyId)
                throw new AppError(
                    `${prefix}Extension belongs to different company`,
                    403
                )
            break
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({
                where: { id: dest.id },
                select: { companyId: true, number: true }
            })
            if (!q) throw new AppError(`${prefix}Queue not found`, 404)
            if (q.companyId !== companyId)
                throw new AppError(
                    `${prefix}Queue belongs to different company`,
                    403
                )
            if (!q.number)
                throw new AppError(
                    `${prefix}Queue has no number - cannot use as route destination`,
                    400
                )
            break
        }
        case 'voicemail':
            // voicemail id é livre (ramal ou id de usuário) - sem FK pra validar
            break
        case 'timecondition': {
            const tc = await prisma.timeCondition.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!tc)
                throw new AppError(`${prefix}Time condition not found`, 404)
            if (tc.companyId !== companyId)
                throw new AppError(
                    `${prefix}Time condition belongs to different company`,
                    403
                )
            break
        }
        case 'holiday': {
            const hg = await prisma.holidayGroup.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!hg) throw new AppError(`${prefix}Holiday group not found`, 404)
            if (hg.companyId !== companyId)
                throw new AppError(
                    `${prefix}Holiday group belongs to different company`,
                    403
                )
            break
        }
        case 'announcement': {
            const ann = await prisma.announcement.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!ann) throw new AppError(`${prefix}Announcement not found`, 404)
            if (ann.companyId !== companyId)
                throw new AppError(
                    `${prefix}Announcement belongs to different company`,
                    403
                )
            break
        }
        case 'ivr': {
            const ivr = await prisma.ivrMenu.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!ivr) throw new AppError(`${prefix}IVR menu not found`, 404)
            if (ivr.companyId !== companyId)
                throw new AppError(
                    `${prefix}IVR menu belongs to different company`,
                    403
                )
            break
        }
        case 'request': {
            const tpl = await prisma.requestTemplate.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!tpl)
                throw new AppError(`${prefix}Request template not found`, 404)
            if (tpl.companyId !== companyId)
                throw new AppError(
                    `${prefix}Request template belongs to different company`,
                    403
                )
            break
        }
        case 'ixc': {
            const node = await prisma.ixcNode.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!node) throw new AppError(`${prefix}IXC node not found`, 404)
            if (node.companyId !== companyId)
                throw new AppError(
                    `${prefix}IXC node belongs to different company`,
                    403
                )
            break
        }
        case 'formatter': {
            const node = await prisma.formatterNode.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!node) throw new AppError(`${prefix}Formatter node not found`, 404)
            if (node.companyId !== companyId)
                throw new AppError(
                    `${prefix}Formatter node belongs to different company`,
                    403
                )
            break
        }
        case 'variable-set': {
            const vs = await prisma.variableSet.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!vs) throw new AppError(`${prefix}Variable set not found`, 404)
            if (vs.companyId !== companyId)
                throw new AppError(
                    `${prefix}Variable set belongs to different company`,
                    403
                )
            break
        }
        case 'variable-condition': {
            const vc = await prisma.variableCondition.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!vc)
                throw new AppError(`${prefix}Variable condition not found`, 404)
            if (vc.companyId !== companyId)
                throw new AppError(
                    `${prefix}Variable condition belongs to different company`,
                    403
                )
            break
        }
        case 'flow': {
            const flow = await prisma.flow.findUnique({
                where: { id: dest.id },
                select: { companyId: true }
            })
            if (!flow) throw new AppError(`${prefix}Flow not found`, 404)
            if (flow.companyId !== companyId)
                throw new AppError(
                    `${prefix}Flow belongs to different company`,
                    403
                )
            break
        }
    }
}

// Guard de delete - barra remover um nó ainda usado como destino em outro fluxo (senão vira Goto
// morto no dialplan regenerado, só descoberto em tempo de chamada). Chamar no topo de deleteX() de
// qualquer entidade que possa ser alvo de RouteDestination, antes do delete em si.
export async function assertNotReferenced(
    targetType: RouteDestType,
    targetId: string
) {
    const [refs, nodeRefs] = await Promise.all([
        FlowEdgeRepository.getReferencesTo(targetType, targetId),
        prisma.flowNode.findMany({
            where: { type: targetType, resourceId: targetId },
            select: { flowId: true }
        })
    ])
    const safeNodeRefs = nodeRefs ?? []
    if (refs.length === 0 && safeNodeRefs.length === 0) return

    const sources = [
        ...new Set(refs.map((r) => SOURCE_LABELS[r.sourceType] ?? r.sourceType))
    ]
    if (safeNodeRefs.length > 0)
        sources.push(`${safeNodeRefs.length} Flow node(s)`)
    throw new AppError(
        `Still referenced by: ${sources.join(', ')} - update or remove those routes first`,
        409
    )
}
