import type { FastifyInstance } from 'fastify'
import { authMiddleware, adminMiddleware } from '../../middlewares/middleware.auth'
import {
    createAnnouncementSchema,
    getAnnouncementSchema,
    updateAnnouncementSchema,
    deleteAnnouncementSchema
} from './schema/announcement.schema'
import { AnnouncementController } from '../../controllers/announcement/announcement.controller'

export const announcementRoutes = async (fastify: FastifyInstance) => {
    const authAdmin = { preHandler: authMiddleware, adminMiddleware }

    fastify.post(
        '/announcements',
        { ...authAdmin, schema: createAnnouncementSchema },
        (request, reply) => new AnnouncementController(request, reply).create()
    )

    fastify.get(
        '/announcements',
        authAdmin,
        (request, reply) => new AnnouncementController(request, reply).list()
    )

    fastify.get(
        '/announcements/:id',
        { ...authAdmin, schema: getAnnouncementSchema },
        (request, reply) => new AnnouncementController(request, reply).getById()
    )

    fastify.put(
        '/announcements/:id',
        { ...authAdmin, schema: updateAnnouncementSchema },
        (request, reply) => new AnnouncementController(request, reply).update()
    )

    fastify.delete(
        '/announcements/:id',
        { ...authAdmin, schema: deleteAnnouncementSchema },
        (request, reply) => new AnnouncementController(request, reply).delete()
    )
}
