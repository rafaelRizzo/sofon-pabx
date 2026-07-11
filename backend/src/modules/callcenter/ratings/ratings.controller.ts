import type { FastifyRequest, FastifyReply } from 'fastify'
import * as RatingsService from './ratings.service'
import { ratingQuerySchema, createRatingSchema } from './schemas/call-rating.schema'
import { handleError } from '../../../utils/errors/handler.error'

export const getRatings = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = ratingQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await RatingsService.getRatingsByCompany(query)) })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createRating = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createRatingSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const rating = await RatingsService.createRating(data)
        return reply.status(201).send({ success: true, message: 'Rating created successfully', ratingId: rating.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
