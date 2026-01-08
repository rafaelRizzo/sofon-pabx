import { type FastifyRequest, type FastifyReply } from 'fastify'
import { handleError } from '../../utils/handler.error'
import { comparePassword } from '../../utils/handler.bcrypt'
import { prisma } from '../../lib/prisma'
import { generateToken, isTokenValid } from '../../utils/handler.jwt'

const userSelect = {
    id: true,
    name: true,
    username: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

export const signIn = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Check username exist')

        const user = await prisma.user.findUnique({
            where: { username: request.body.username }
        })

        if (!user) {
            return reply.status(401).send({
                success: false,
                message: 'Credenciais inválidas'
            })
        }

        request.log.info('Verify password')
        const isPasswordValid = await comparePassword(request.body.password, user.password)

        if (!isPasswordValid) {
            return reply.status(401).send({
                success: false,
                message: 'Credenciais inválidas'
            })
        }

        let token = user.token

        // Verifica se token existe e é válido
        if (user.token && isTokenValid(user.token)) {
            request.log.info('Existing token is valid, reusing')
        } else {
            request.log.info('Creating new token')
            token = generateToken({
                id: user.id,
                username: user.username,
                role: user.role
            })

            // Atualiza token no banco
            await prisma.user.update({
                where: { id: user.id },
                data: { token }
            })
        }

        request.log.info('Sign-in successful')
        return reply.status(200).send({
            success: true,
            message: 'Login realizado com sucesso',
            token
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao fazer login')
    }
}