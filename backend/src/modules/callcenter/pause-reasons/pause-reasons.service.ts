import { prisma } from '../../../lib/prisma'
import { getCompanyById } from '../../companies/companies.service'
import type { CreatePauseReasonInput, UpdatePauseReasonInput } from './schemas/pause-reason.schema'
import { AppError } from '../../../utils/errors/app.error'

const pauseReasonSelect = {
    id: true,
    companyId: true,
    label: true,
    active: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getPauseReasonsByCompany = async (companyId: string, activeOnly = false) => {
    await getCompanyById(companyId)
    return prisma.pauseReason.findMany({
        where: { companyId, ...(activeOnly ? { active: true } : {}) },
        select: pauseReasonSelect,
        orderBy: { label: 'asc' },
    })
}

export const createPauseReason = async (data: CreatePauseReasonInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.pauseReason.findUnique({
        where: { companyId_label: { companyId: data.companyId, label: data.label } },
    })
    if (existing) throw new AppError('Pause reason already exists for this company', 409)

    return prisma.pauseReason.create({ data, select: pauseReasonSelect })
}

export const updatePauseReason = async (id: string, data: UpdatePauseReasonInput) => {
    const existing = await prisma.pauseReason.findUnique({ where: { id } })
    if (!existing) throw new AppError('Pause reason not found', 404)

    if (data.label !== undefined && data.label !== existing.label) {
        const duplicate = await prisma.pauseReason.findUnique({
            where: { companyId_label: { companyId: existing.companyId, label: data.label } },
        })
        if (duplicate) throw new AppError('Pause reason label already in use for this company', 409)
    }

    return prisma.pauseReason.update({ where: { id }, data, select: pauseReasonSelect })
}

export const deletePauseReason = async (id: string) => {
    const existing = await prisma.pauseReason.findUnique({ where: { id } })
    if (!existing) throw new AppError('Pause reason not found', 404)
    await prisma.pauseReason.delete({ where: { id } })
}
