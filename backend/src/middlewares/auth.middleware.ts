import type { FastifyRequest, FastifyReply } from 'fastify'

export const verifyToken = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        await req.jwtVerify()
    } catch {
        return reply.status(401).send({ message: 'Unauthorized' })
    }
}

export const verifyAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        await req.jwtVerify()
        const payload = req.user as { id: string; role: 'admin' | 'user' }
        if (payload.role !== 'admin') {
            return reply.status(403).send({ message: 'Forbidden' })
        }
    } catch {
        return reply.status(401).send({ message: 'Unauthorized' })
    }
}