import type { ApplicationsType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { checkDestinationId } from '../../utils/handler.destinations'
import { AppError } from '../../utils/handler.error'

type TimeConditionType = {
    name: string
    description?: string
    trueDestinationApp: ApplicationsType
    trueDestinationId?: string
    falseDestinationApp: ApplicationsType
    falseDestinationId?: string
    companyId: string
}

type UpdateTimeConditionType = {
    name?: string
    description?: string
    trueDestinationApp?: ApplicationsType
    trueDestinationId?: string
    falseDestinationApp?: ApplicationsType
    falseDestinationId?: string
}

export const timeConditionSelect = {
    id: true,
    name: true,
    companyId: true,
    trueDestinationApp: true,
    trueDestinationId: true,
    falseDestinationApp: true,
    falseDestinationId: true,
    description: true,
    createdAt: true,
    updatedAt: true
}

export class TimeConditionService {

    async create(timeCondition: TimeConditionType) {
        const existing = await prisma.timeCondition.findUnique({
            where: {
                companyId_name: {
                    companyId: timeCondition.companyId,
                    name: timeCondition.name
                }
            }
        })

        if (existing) {
            throw new AppError('Condição de tempo já cadastrada para esta empresa', 409)
        }

        await checkDestinationId(
            timeCondition.trueDestinationApp,
            timeCondition.trueDestinationId
        )

        await checkDestinationId(
            timeCondition.falseDestinationApp,
            timeCondition.falseDestinationId
        )

        return prisma.timeCondition.create({
            data: {
                name: timeCondition.name,
                companyId: timeCondition.companyId,
                trueDestinationApp: timeCondition.trueDestinationApp,
                trueDestinationId: timeCondition.trueDestinationId ?? null,
                falseDestinationApp: timeCondition.falseDestinationApp,
                falseDestinationId: timeCondition.falseDestinationId ?? null,
                description: timeCondition.description
            },
            select: timeConditionSelect
        })
    }

    async list(companyId?: string) {
        return prisma.timeCondition.findMany({
            where: companyId ? { companyId } : undefined,
            select: timeConditionSelect,
            orderBy: { createdAt: 'desc' }
        })
    }

    async getById(id: string) {
        const timeCondition = await prisma.timeCondition.findUnique({
            where: { id },
            select: timeConditionSelect
        })

        if (!timeCondition) {
            throw new AppError('Condição de tempo não encontrada', 404)
        }

        return timeCondition
    }

    async update(id: string, data: UpdateTimeConditionType) {
        const existing = await prisma.timeCondition.findUnique({
            where: { id }
        })

        if (!existing) {
            throw new AppError('Condição de tempo não encontrada', 404)
        }

        if (data.name && data.name !== existing.name) {
            const duplicate = await prisma.timeCondition.findFirst({
                where: {
                    companyId: existing.companyId,
                    name: data.name,
                    id: { not: id }
                }
            })

            if (duplicate) {
                throw new AppError('Já existe uma condição de tempo com esse nome', 409)
            }
        }

        const updateData: any = {}

        if (data.name) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description

        if (data.trueDestinationApp && data.trueDestinationId !== undefined) {
            await checkDestinationId(
                data.trueDestinationApp,
                data.trueDestinationId
            )

            updateData.trueDestinationApp = data.trueDestinationApp
            updateData.trueDestinationId = data.trueDestinationId ?? null
        }

        if (data.falseDestinationApp && data.falseDestinationId !== undefined) {
            await checkDestinationId(
                data.falseDestinationApp,
                data.falseDestinationId
            )

            updateData.falseDestinationApp = data.falseDestinationApp
            updateData.falseDestinationId = data.falseDestinationId ?? null
        }

        return prisma.timeCondition.update({
            where: { id },
            data: updateData,
            select: timeConditionSelect
        })
    }

    async delete(id: string) {
        const existing = await prisma.timeCondition.findUnique({
            where: { id }
        })

        if (!existing) {
            throw new AppError('Condição de tempo não encontrada', 404)
        }

        await prisma.timeCondition.delete({ where: { id } })

        return true
    }
}
