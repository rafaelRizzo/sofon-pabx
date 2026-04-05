import type { FastifyRequest } from 'fastify'

export const getLoggedUser = (req: FastifyRequest) => {
    return req.user as {
        id: string
        role: 'admin' | 'user'
    }
}