import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createAudioSchema,
    getAudioSchema,
    deleteAudioSchema
} from './schema/audio.schema'
import { AudioController } from '../../controllers/audio/audio.controller'

export const audioRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    // Aqui removi o schema pois valido no service, fica melhor pois o fastify não consegue lidar muito bem direto aqui, além do TS só reclamar que o fastify nao conhece o schema direito...
    fastify.post(
        '/audios',
        { ...authAdmin },
        (request, reply) => new AudioController(request, reply).create()
    )

    fastify.get(
        '/audios',
        authAdmin,
        (request, reply) => new AudioController(request, reply).list()
    )

    fastify.get(
        '/audios/:id',
        { ...authAdmin, schema: getAudioSchema },
        (request, reply) => new AudioController(request, reply).getById()
    )

    fastify.delete(
        '/audios/:id',
        { ...authAdmin, schema: deleteAudioSchema },
        (request, reply) => new AudioController(request, reply).delete()
    )
}
