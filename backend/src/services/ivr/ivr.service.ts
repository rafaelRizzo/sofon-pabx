import type { ApplicationsType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { checkDestinationId } from '../../utils/handler.destinations'
import { AppError } from '../../utils/handler.error'

type CreateIVRType = {
    name: string
    description?: string
    audioId?: string
    timeout?: number
    maxRetries?: number
    timeoutDestinationApp: ApplicationsType
    timeoutDestinationId?: string
    invalidDestinationApp: ApplicationsType
    invalidDestinationId?: string
    companyId: string
}

type UpdateIVRType = {
    name?: string
    description?: string
    audioId?: string
    timeout?: number
    maxRetries?: number
    timeoutDestinationApp?: ApplicationsType
    timeoutDestinationId?: string
    invalidDestinationApp?: ApplicationsType
    invalidDestinationId?: string
}

export const ivrSelect = {
    id: true,
    name: true,
    description: true,
    audioId: true,
    timeout: true,
    maxRetries: true,
    timeoutDestinationApp: true,
    timeoutDestinationId: true,
    invalidDestinationApp: true,
    invalidDestinationId: true,
    companyId: true,
    createdAt: true,
    updatedAt: true
}

export class IVRService {

    async create(data: CreateIVRType) {
        const existingIVR = await prisma.iVR.findUnique({
            where: {
                companyId_name: {
                    companyId: data.companyId,
                    name: data.name
                }
            }
        })

        if (existingIVR) {
            throw new AppError('IVR já cadastrado para esta empresa', 409)
        }

        await checkDestinationId(
            data.timeoutDestinationApp,
            data.timeoutDestinationId
        )

        await checkDestinationId(
            data.invalidDestinationApp,
            data.invalidDestinationId
        )

        return await prisma.iVR.create({
            data: {
                name: data.name,
                description: data.description,
                audioId: data.audioId,
                timeout: data.timeout,
                maxRetries: data.maxRetries,
                timeoutDestinationApp: data.timeoutDestinationApp,
                timeoutDestinationId: data.timeoutDestinationId,
                invalidDestinationApp: data.invalidDestinationApp,
                invalidDestinationId: data.invalidDestinationId,
                companyId: data.companyId
            },
            select: ivrSelect
        })
    }

    async list(companyId?: string) {
        return await prisma.iVR.findMany({
            where: companyId ? { companyId } : undefined,
            select: ivrSelect,
            orderBy: {
                createdAt: 'desc'
            }
        })
    }

    async getById(id: string) {
        const ivr = await prisma.iVR.findUnique({
            where: { id },
            select: ivrSelect
        })

        if (!ivr) {
            throw new AppError('IVR não encontrado', 404)
        }

        return ivr
    }

    async update(id: string, data: UpdateIVRType) {
        const existingIVR = await prisma.iVR.findUnique({
            where: { id }
        })

        if (!existingIVR) {
            throw new AppError('IVR não encontrado', 404)
        }

        if (data.name && data.name !== existingIVR.name) {
            const duplicateName = await prisma.iVR.findFirst({
                where: {
                    companyId: existingIVR.companyId,
                    name: data.name,
                    id: { not: id }
                }
            })

            if (duplicateName) {
                throw new AppError('Nome de IVR já cadastrado para esta empresa', 409)
            }
        }

        if (data.timeoutDestinationApp) {
            await checkDestinationId(
                data.timeoutDestinationApp,
                data.timeoutDestinationId
            )
        }

        if (data.invalidDestinationApp) {
            await checkDestinationId(
                data.invalidDestinationApp,
                data.invalidDestinationId
            )
        }

        return await prisma.iVR.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                audioId: data.audioId,
                timeout: data.timeout,
                maxRetries: data.maxRetries,
                timeoutDestinationApp: data.timeoutDestinationApp,
                timeoutDestinationId: data.timeoutDestinationId,
                invalidDestinationApp: data.invalidDestinationApp,
                invalidDestinationId: data.invalidDestinationId
            },
            select: ivrSelect
        })
    }

    async delete(id: string) {
        const ivr = await prisma.iVR.findUnique({
            where: { id }
        })

        if (!ivr) {
            throw new AppError('IVR não encontrado', 404)
        }

        await prisma.iVR.delete({
            where: { id }
        })

        return true
    }
}
