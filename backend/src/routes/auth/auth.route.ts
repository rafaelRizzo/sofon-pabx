import { type FastifyInstance } from 'fastify'
import { signInSchema } from './schema/auth.schema'
import { signIn } from '../../controllers/auth/auth.controller'

export const authRoutes = async (fastify: FastifyInstance) => {

    fastify.post('/sign-in', { schema: signInSchema }, signIn)

}