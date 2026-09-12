import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AgentStatusService from './agent-status.service'
import { setAgentStatusSchema } from './schemas/agent-status.schema'
import { handleError } from '../../../utils/errors/handler.error'

export const getMyStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const status = await AgentStatusService.getMyStatus(req.user!.id)
        return reply.send({ success: true, message: 'Agent status fetched successfully', status })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const setMyStatus = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = setAgentStatusSchema.parse(req.body)
        const status = await AgentStatusService.setMyStatus(req.user!.id, data)
        return reply.send({ success: true, message: data.paused ? 'Agente pausado' : 'Agente disponível', status })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
