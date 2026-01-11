import { type FastifyInstance } from 'fastify'
import { signInSchema } from './schema/auth.schema'
import { AuthController } from '../../controllers/auth/auth.controller'

export const authRoutes = async (fastify: FastifyInstance) => {

    fastify.post(
        '/sign-in',
        { schema: signInSchema },
        (request, reply) => new AuthController(request, reply).signIn()
    )
}