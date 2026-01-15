import type { ApplicationsType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { checkDestinationId } from '../../utils/handler.destinations'
import { AppError } from '../../utils/handler.error'

type InboundRouteType = {
    name: string
    companyId: string
    numberReceived: string
    destinationApp: ApplicationsType
    destinationId: string
    description?: string
}

type UpdateInboundRouteType = Partial<InboundRouteType>

export const inboundRouteSelect = {
    id: true,
    name: true,
    companyId: true,
    numberReceived: true,
    destinationApp: true,
    destinationId: true,
    description: true,
    createdAt: true,
    updatedAt: true
}

export class InboundRouteService {

    async create(inboundRoute: InboundRouteType) {
        // Verifica se já existe uma rota com o mesmo número para esta empresa
        const existingInboundRoute = await prisma.inboundRoute.findUnique({
            where: {
                companyId_numberReceived: {
                    companyId: inboundRoute.companyId,
                    numberReceived: inboundRoute.numberReceived
                }
            }
        })

        if (existingInboundRoute) {
            throw new AppError('Número já cadastrado para esta empresa', 409)
        }

        // Verifica se já existe uma rota com o mesmo nome para esta empresa
        const existingName = await prisma.inboundRoute.findUnique({
            where: {
                companyId_name: {
                    companyId: inboundRoute.companyId,
                    name: inboundRoute.name
                }
            }
        })

        if (existingName) {
            throw new AppError('Nome já cadastrado para esta empresa', 409)
        }

        await checkDestinationId(inboundRoute.destinationApp, inboundRoute.destinationId)

        const inboundRouteCreated = await prisma.inboundRoute.create({
            data: {
                name: inboundRoute.name,
                companyId: inboundRoute.companyId,
                numberReceived: inboundRoute.numberReceived,
                destinationApp: inboundRoute.destinationApp,
                destinationId: inboundRoute.destinationId,
                description: inboundRoute.description
            },
            select: inboundRouteSelect
        })

        return inboundRouteCreated
    }

    async list(companyId?: string) {
        return await prisma.inboundRoute.findMany({
            where: companyId ? { companyId } : undefined,
            select: inboundRouteSelect,
            orderBy: {
                createdAt: 'desc'
            }
        })
    }

    async getById(id: string) {
        const inboundRoute = await prisma.inboundRoute.findUnique({
            where: {
                id: id
            },
            select: inboundRouteSelect
        })

        if (!inboundRoute) {
            throw new AppError('Rota de entrada não encontrada', 404)
        }

        return inboundRoute
    }

    async update(id: string, data: UpdateInboundRouteType) {
        // Verifica se a rota existe
        const existingRoute = await prisma.inboundRoute.findUnique({
            where: { id }
        })

        if (!existingRoute) {
            throw new AppError('Rota de entrada não encontrada', 404)
        }

        // Se estiver alterando o número, verifica se não existe outro com o mesmo número
        if (data.numberReceived && data.numberReceived !== existingRoute.numberReceived) {
            const duplicateNumber = await prisma.inboundRoute.findFirst({
                where: {
                    companyId: existingRoute.companyId,
                    numberReceived: data.numberReceived,
                    id: { not: id }
                }
            })

            if (duplicateNumber) {
                throw new AppError('Número já cadastrado para esta empresa', 409)
            }
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
                throw new AppError('Nome já cadastrado para esta empresa', 409)
            }
        }

        const updateData: any = {}

        if (data.name) updateData.name = data.name
        if (data.numberReceived) updateData.numberReceived = data.numberReceived

        if (data.destinationApp && data.destinationId) {
            updateData.destinationApp = data.destinationApp
            updateData.destinationId = data.destinationId

            await checkDestinationId(updateData.destinationApp, updateData.destinationId)
        }

        if (data.description !== undefined) updateData.description = data.description

        return await prisma.inboundRoute.update({
            where: {
                id: id
            },
            data: updateData,
            select: inboundRouteSelect
        })
    }

    async delete(id: string) {
        const inboundRoute = await prisma.inboundRoute.findUnique({
            where: {
                id: id
            }
        })

        if (!inboundRoute) {
            throw new AppError('Rota de entrada não encontrada', 404)
        }

        await prisma.inboundRoute.delete({
            where: {
                id: id
            }
        })

        return true
    }
}