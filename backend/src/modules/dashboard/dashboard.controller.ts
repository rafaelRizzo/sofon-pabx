import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './dashboard.service'
import { dashboardOverviewQuerySchema as optionalCompanyQuery } from './schemas/dashboard.schema'
import { handleError } from '../../utils/errors/handler.error'

// Mesmo padrão de realtime.controller.ts - ?companyId estreita dentro do scope do usuário
// (assertAccess valida posse), sem filtro = agregado de todas as empresas que o usuário já vê
export const getOverview = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const filter = optionalCompanyQuery.safeParse(req.query)
        if (filter.success && filter.data.companyId) {
            req.scope.assertAccess(filter.data.companyId)
            const overview = await Service.getDashboardOverview([filter.data.companyId])
            return reply.send({ success: true, overview })
        }
        const overview = await Service.getDashboardOverview(req.scope.companyIds ?? undefined)
        return reply.send({ success: true, overview })
    } catch (e) {
        return handleError(reply, e, req)
    }
}

export const getInfra = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const infra = await Service.getDashboardInfra()
        return reply.send({ success: true, infra })
    } catch (e) {
        return handleError(reply, e, req)
    }
}
