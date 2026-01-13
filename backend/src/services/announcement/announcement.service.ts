import type { ApplicationsType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { checkDestinationId } from '../../utils/handler.destinations'
import { AppError } from '../../utils/handler.error'

type AnnouncementType = {
    name: string
    companyId: string
    audioId: string
    destinationApp: ApplicationsType
    destinationId: string
    description?: string
}

type UpdateAnnouncementType = {
    name?: string
    companyId?: string
    audioId?: string
    destinationApp?: ApplicationsType
    destinationId?: string
    description?: string
}

export const announcementSelect = {
    id: true,
    name: true,
    companyId: true,
    audioId: true,
    destinationApp: true,
    destinationId: true,
    description: true,
    createdAt: true,
    updatedAt: true
}

export class AnnouncementService {

    async create(announcement: AnnouncementType) {
        // Verifica se já existe um anuncio com o mesmo nome para esta empresa
        const existingAnnouncement = await prisma.announcement.findUnique({
            where: {
                companyId_name: {
                    companyId: announcement.companyId,
                    name: announcement.name
                }
            }
        })

        if (existingAnnouncement) {
            throw new AppError('Anúncio já cadastrado para esta empresa', 409)
        }

        await checkDestinationId(announcement.destinationApp, announcement.destinationId)

        const announcementCreated = await prisma.announcement.create({
            data: {
                name: announcement.name,
                companyId: announcement.companyId,
                audioId: announcement.audioId,
                destinationApp: announcement.destinationApp,
                destinationId: announcement.destinationId,
                description: announcement.description
            },
            select: announcementSelect
        })

        return announcementCreated
    }

    async list(companyId?: string) {
        return await prisma.announcement.findMany({
            where: companyId ? { companyId } : undefined,
            select: announcementSelect,
            orderBy: {
                createdAt: 'desc'
            }
        })
    }

    async getById(id: string) {
        const announcement = await prisma.announcement.findUnique({
            where: {
                id: id
            },
            select: announcementSelect
        })

        if (!announcement) {
            throw new AppError('Anúncio não encontrado', 404)
        }

        return announcement
    }

    async update(id: string, data: UpdateAnnouncementType) {
        // Verifica se a rota existe
        const existingRoute = await prisma.announcement.findUnique({
            where: { id }
        })

        if (!existingRoute) {
            throw new AppError('Anúncio não encontrado', 404)
        }

        // Se estiver alterando o nome, verifica se não existe outro com o mesmo nome
        if (data.name && data.name !== existingRoute.name) {
            const duplicateName = await prisma.inboundRoute.findFirst({
                where: {
                    companyId: existingRoute.companyId,
                    name: data.name,
                    id: { not: id }
                }
            })

            if (duplicateName) {
                throw new AppError('Já existe um anúncio com esse nome', 409)
            }
        }

        const updateData: any = {}

        if (data.name) updateData.name = data.name

        if (data.destinationApp && data.destinationId) {
            updateData.destinationApp = data.destinationApp
            updateData.destinationId = data.destinationId

            await checkDestinationId(updateData.destinationApp, updateData.destinationId)
        }

        if (data.description !== undefined) updateData.description = data.description

        return await prisma.announcement.update({
            where: {
                id: id
            },
            data: updateData,
            select: announcementSelect
        })
    }

    async delete(id: string) {
        const announcement = await prisma.announcement.findUnique({
            where: {
                id: id
            }
        })

        if (!announcement) {
            throw new AppError('Rota de entrada não encontrada', 404)
        }

        await prisma.announcement.delete({
            where: {
                id: id
            }
        })

        return true
    }
}