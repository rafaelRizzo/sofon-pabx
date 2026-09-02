import { prisma } from '../../../lib/prisma'
import { getCompanyById } from '../../companies/companies.service'
import { getExtensionDto } from '../../extensions/extensions.service'
import type { RatingQueryInput, CreateRatingInput } from './schemas/call-rating.schema'

export const getRatingsByCompany = async (query: RatingQueryInput) => {
    await getCompanyById(query.companyId)

    const where = {
        companyId: query.companyId,
        ...(query.extensionId && { extensionId: query.extensionId }),
        ...(query.number && { number: { contains: query.number } }),
        ...(query.score && { score: query.score }),
        ...(query.category && { category: query.category }),
        ...((query.startDate || query.endDate) && {
            createdAt: {
                ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
                ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
            },
        }),
    }

    const [rows, total] = await Promise.all([
        prisma.callRating.findMany({
            where,
            orderBy: [{ createdAt: query.order }, { id: query.order }],
            take: query.limit,
        }),
        prisma.callRating.count({ where }),
    ])

    return { records: rows, total, limit: query.limit }
}

export const createRating = async (data: CreateRatingInput) => {
    await getCompanyById(data.companyId)
    await getExtensionDto(data.extensionId)

    return prisma.callRating.create({ data })
}
