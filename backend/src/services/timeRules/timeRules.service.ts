import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/handler.error'
import type { RecurrencyType } from '../../generated/prisma/enums'

type TimeRuleType = {
    name: string
    recurrencyType: RecurrencyType

    startDate?: Date
    endDate?: Date

    startTime: string
    endTime: string

    weekDays?: number[]
    monthDays?: number[]
    months?: number[]

    timeConditionId: string
    companyId: string
}

type UpdateTimeRuleType = Partial<TimeRuleType>

export const timeRuleSelect = {
    id: true,
    name: true,
    recurrencyType: true,

    startDate: true,
    endDate: true,

    startTime: true,
    endTime: true,

    weekDays: true,
    monthDays: true,
    months: true,

    timeConditionId: true,
    companyId: true,

    createdAt: true,
    updatedAt: true
}

export class TimeRuleService {
    async create(data: TimeRuleType) {
        const existing = await prisma.timeRule.findFirst({
            where: {
                companyId: data.companyId,
                timeConditionId: data.timeConditionId,
                name: data.name
            }
        })

        if (existing) {
            throw new AppError('Regra de tempo já cadastrada para esta condição', 409)
        }

        if (data.startDate && data.endDate && data.startDate > data.endDate) {
            throw new AppError('endDate deve ser maior ou igual a startDate', 400)
        }
        const timeCondition = await prisma.timeCondition.findUnique({
            where: {
                id: data.timeConditionId
            }
        })

        if (!timeCondition) {
            throw new AppError('TimeCondition não encontrada', 404)
        }

        if (timeCondition.companyId !== data.companyId) {
            throw new AppError('TimeCondition não pertence à empresa informada', 403)
        }

        return prisma.timeRule.create({
            data: {
                name: data.name,
                recurrencyType: data.recurrencyType,

                startDate: data.startDate ?? null,
                endDate: data.endDate ?? null,

                startTime: data.startTime,
                endTime: data.endTime,

                weekDays: data.weekDays ?? [],
                monthDays: data.monthDays ?? [],
                months: data.months ?? [],

                timeConditionId: data.timeConditionId,
                companyId: data.companyId
            },
            select: timeRuleSelect
        })
    }

    async list(companyId?: string, timeConditionId?: string) {
        return prisma.timeRule.findMany({
            where: {
                ...(companyId && { companyId }),
                ...(timeConditionId && { timeConditionId })
            },
            select: timeRuleSelect,
            orderBy: { createdAt: 'desc' }
        })
    }

    async getById(id: string) {
        const rule = await prisma.timeRule.findUnique({
            where: { id },
            select: timeRuleSelect
        })

        if (!rule) {
            throw new AppError('Regra de tempo não encontrada', 404)
        }

        return rule
    }

    async update(id: string, data: UpdateTimeRuleType) {
        const existing = await prisma.timeRule.findUnique({
            where: { id }
        })

        if (!existing) {
            throw new AppError('Regra de tempo não encontrada', 404)
        }

        if (
            data.startDate &&
            data.endDate &&
            data.startDate > data.endDate
        ) {
            throw new AppError('endDate deve ser maior ou igual a startDate', 400)
        }

        if (data.name && data.name !== existing.name) {
            const duplicate = await prisma.timeRule.findFirst({
                where: {
                    companyId: existing.companyId,
                    timeConditionId: existing.timeConditionId,
                    name: data.name,
                    id: { not: id }
                }
            })

            if (duplicate) {
                throw new AppError('Já existe uma regra com esse nome nesta condição', 409)
            }
        }

        const updateData: any = {}

        if (data.name) updateData.name = data.name
        if (data.recurrencyType)
            updateData.recurrencyType = data.recurrencyType

        if (data.startDate !== undefined)
            updateData.startDate = data.startDate
        if (data.endDate !== undefined)
            updateData.endDate = data.endDate

        if (data.startTime) updateData.startTime = data.startTime
        if (data.endTime) updateData.endTime = data.endTime

        if (data.weekDays !== undefined)
            updateData.weekDays = data.weekDays
        if (data.monthDays !== undefined)
            updateData.monthDays = data.monthDays
        if (data.months !== undefined)
            updateData.months = data.months

        return prisma.timeRule.update({
            where: { id },
            data: updateData,
            select: timeRuleSelect
        })
    }

    async delete(id: string) {
        const existing = await prisma.timeRule.findUnique({
            where: { id }
        })

        if (!existing) {
            throw new AppError('Regra de tempo não encontrada', 404)
        }

        await prisma.timeRule.delete({
            where: { id }
        })

        return true
    }
}
