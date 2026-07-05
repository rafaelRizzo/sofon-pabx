import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AnnouncementsService from './announcements.service'
import { createAnnouncementSchema, updateAnnouncementSchema, idParamSchema, companyQuerySchema } from './schemas/announcement.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getAnnouncements = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const announcements = await AnnouncementsService.getAnnouncementsByCompany(companyId)
        return reply.send({ success: true, message: 'Announcements fetched successfully', announcements })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getAnnouncementById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.announcement.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Announcement not found', 404)
        req.scope.assertAccess(owner.companyId)
        const announcement = await AnnouncementsService.getAnnouncementById(id)
        return reply.send({ success: true, message: 'Announcement fetched successfully', announcement })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createAnnouncement = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createAnnouncementSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const announcement = await AnnouncementsService.createAnnouncement(data)
        return reply.status(201).send({ success: true, message: 'Announcement created successfully', announcementId: announcement.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateAnnouncement = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateAnnouncementSchema.parse(req.body)
        const existing = await prisma.announcement.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Announcement not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AnnouncementsService.updateAnnouncement(id, data)
        return reply.send({ success: true, message: 'Announcement updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteAnnouncement = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.announcement.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Announcement not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AnnouncementsService.deleteAnnouncement(id)
        return reply.send({ success: true, message: 'Announcement deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
