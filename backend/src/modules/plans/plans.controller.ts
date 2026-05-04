import type { FastifyRequest, FastifyReply } from 'fastify'
import { createPlanSchema, updatePlanSchema, idParamSchema } from './schemas/plans.schema'
import * as PlanService from './plans.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

export const getPlans = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const plans = await PlanService.getAllPlans()

        return reply.send({
            success: true,
            plans
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getPlanById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        const plan = await PlanService.getPlanById(id)
        if (!plan) return reply.status(404).send({
            success: false,
            message: 'Plan not found'
        })

        return reply.send({
            success: true,
            plan
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createPlan = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'Only admins can create plans'
            })
        }

        const data = createPlanSchema.parse(req.body)
        const plan = await PlanService.createPlan(data)

        if (!plan) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create plan'
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'Plan created successfully',
            plan_id: plan.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updatePlan = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'Only admins can update plans'
            })
        }

        const { id } = idParamSchema.parse(req.params)
        const data = updatePlanSchema.parse(req.body)

        const existingPlan = await PlanService.getPlanById(id)
        if (!existingPlan) {
            return reply.status(404).send({
                success: false,
                message: 'Plan not found'
            })
        }

        await PlanService.updatePlan(id, data)

        return reply.send({
            success: true,
            message: 'Plan updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deletePlan = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'Only admins can delete plans'
            })
        }

        const { id } = idParamSchema.parse(req.params)

        const plan = await PlanService.deletePlan(id)
        if (!plan) return reply.status(404).send({
            success: false,
            message: 'Plan not found'
        })

        return reply.send({
            success: true,
            message: 'Plan deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
