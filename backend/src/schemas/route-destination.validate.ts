import { prisma } from '../lib/prisma'
import { AppError } from '../utils/errors/app.error'
import { getExtensionDto } from '../modules/extensions/extensions.service'
import type { RouteDestination } from './route-destination.schema'

// Validação de existência/posse compartilhada por Inbound Routes e Time Conditions
// (trueRoute/falseRoute) — mesmo destino, mesmas regras, um lugar só.
// label prefixa a mensagem (ex: "trueRoute: ") quando o caller tem mais de um campo de destino.
export async function validateRouteDestination(dest: RouteDestination, companyId: string, label?: string) {
    if (!dest || dest.type === 'hangup') return
    const prefix = label ? `${label}: ` : ''

    switch (dest.type) {
        case 'extension': {
            const ext = await getExtensionDto(dest.id).catch(() => {
                throw new AppError(`${prefix}Extension not found`, 404)
            })
            if (ext.companyId !== companyId) throw new AppError(`${prefix}Extension belongs to different company`, 403)
            break
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: dest.id }, select: { companyId: true, number: true } })
            if (!q) throw new AppError(`${prefix}Queue not found`, 404)
            if (q.companyId !== companyId) throw new AppError(`${prefix}Queue belongs to different company`, 403)
            if (!q.number) throw new AppError(`${prefix}Queue has no number — cannot use as route destination`, 400)
            break
        }
        case 'voicemail':
            // voicemail id é livre (ramal ou id de usuário) — sem FK pra validar
            break
        case 'timecondition': {
            const tc = await prisma.timeCondition.findUnique({ where: { id: dest.id }, select: { companyId: true } })
            if (!tc) throw new AppError(`${prefix}Time condition not found`, 404)
            if (tc.companyId !== companyId) throw new AppError(`${prefix}Time condition belongs to different company`, 403)
            break
        }
        case 'announcement': {
            const ann = await prisma.announcement.findUnique({ where: { id: dest.id }, select: { companyId: true, audioUploadedAt: true } })
            if (!ann) throw new AppError(`${prefix}Announcement not found`, 404)
            if (ann.companyId !== companyId) throw new AppError(`${prefix}Announcement belongs to different company`, 403)
            if (!ann.audioUploadedAt) throw new AppError(`${prefix}Announcement has no audio uploaded yet`, 400)
            break
        }
    }
}
