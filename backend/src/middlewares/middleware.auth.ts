import { type FastifyRequest, type FastifyReply } from 'fastify'
import { verifyToken } from '../utils/handler.jwt'
import { prisma } from '../lib/prisma'

interface TokenPayload {
    id: string
    username: string
    role: string
}

declare module 'fastify' {
    interface FastifyRequest {
        user?: TokenPayload
    }
}

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const authHeader = request.headers.authorization

        if (!authHeader) {
            return reply.code(401).send({
                success: false,
                message: 'Token não fornecido'
            })
        }

        const [scheme, token] = authHeader.split(' ')

        if (scheme !== 'Bearer' || !token) {
            return reply.code(401).send({
                success: false,
                message: 'Formato de token inválido'
            })
        }

        const decoded = verifyToken(token)

        if (!decoded) {
            return reply.code(401).send({
                success: false,
                message: 'Token inválido ou expirado'
            })
        }

        // Busca o usuário no banco usando o id do token
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true
            }
        })

        if (!user) {
            return reply.code(401).send({
                success: false,
                message: 'Token inválido'
            })
        }

        request.user = decoded
    } catch (error) {
        request.log.error(error)
        return reply.code(500).send({
            success: false,
            message: 'Erro ao validar token'
        })
    }
}

export const adminMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
        return reply.code(401).send({
            success: false,
            message: 'Usuário não autenticado'
        })
    }

    if (request.user.role !== 'admin') {
        return reply.code(403).send({
            success: false,
            message: 'Acesso negado. Apenas administradores podem acessar este recurso'
        })
    }
}