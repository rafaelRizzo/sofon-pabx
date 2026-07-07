import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { RequestTemplatesCache } from './cache/request-templates.cache'
import { RequestTemplateRepository } from '../../asterisk/request-template.repository'
import { validateRouteDestination } from '../../schemas/route-destination.validate'
import type { CreateRequestTemplateInput, UpdateRequestTemplateInput } from './schemas/request-template.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    method: true,
    url: true,
    headers: true,
    body: true,
    timeoutMs: true,
    variableMappings: true,
    onSuccess: true,
    onError: true,
    createdAt: true,
    updatedAt: true,
} as const

const validateDest = (dest: any, companyId: string, label: string) =>
    validateRouteDestination(dest ?? null, companyId, label)

export const getAllRequestTemplates = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await RequestTemplatesCache.getAll()
        if (cached) return cached
    }

    const templates = await prisma.requestTemplate.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select,
    })

    if (!companyIds) await RequestTemplatesCache.setAll(templates)
    return templates
}

export const getRequestTemplatesByCompany = async (companyId: string) => {
    const cached = await RequestTemplatesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const templates = await prisma.requestTemplate.findMany({ where: { companyId }, select })
    await RequestTemplatesCache.setByCompany(companyId, templates)
    return templates
}

export const getRequestTemplateById = async (id: string) => {
    const cached = await RequestTemplatesCache.getTemplate(id)
    if (cached) return cached

    const template = await prisma.requestTemplate.findUnique({ where: { id }, select })
    if (!template) throw new AppError('Request template not found', 404)

    await RequestTemplatesCache.setTemplate(id, template)
    return template
}

export const createRequestTemplate = async (data: CreateRequestTemplateInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.requestTemplate.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Request template already exists for this company', 409)

    await validateDest(data.onSuccess, data.companyId, 'onSuccess')
    await validateDest(data.onError, data.companyId, 'onError')

    const template = await prisma.$transaction(async (tx) => {
        const created = await tx.requestTemplate.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                method: data.method,
                url: data.url,
                headers: data.headers ?? undefined,
                body: (data.body as Prisma.InputJsonValue) ?? undefined,
                timeoutMs: data.timeoutMs,
                variableMappings: data.variableMappings,
                onSuccess: data.onSuccess ?? undefined,
                onError: data.onError ?? undefined,
            },
            select,
        })
        return created
    })

    await RequestTemplateRepository.regenerate(data.companyId)
    await RequestTemplatesCache.invalidateByCompany(data.companyId)
    await RequestTemplatesCache.invalidateAll()
    return template
}

export const updateRequestTemplate = async (id: string, data: UpdateRequestTemplateInput) => {
    const existing = await prisma.requestTemplate.findUnique({ where: { id } })
    if (!existing) throw new AppError('Request template not found', 404)

    if (data.name && data.name !== existing.name) {
        const conflict = await prisma.requestTemplate.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Request template already exists for this company', 409)
    }

    if (data.onSuccess !== undefined) await validateDest(data.onSuccess, existing.companyId, 'onSuccess')
    if (data.onError !== undefined) await validateDest(data.onError, existing.companyId, 'onError')

    const template = await prisma.requestTemplate.update({
        where: { id },
        data: {
            name: data.name,
            method: data.method,
            url: data.url,
            headers: data.headers === undefined ? undefined : (data.headers ?? Prisma.JsonNull),
            body: data.body === undefined ? undefined : ((data.body as Prisma.InputJsonValue) ?? Prisma.JsonNull),
            timeoutMs: data.timeoutMs,
            variableMappings: data.variableMappings,
            onSuccess: data.onSuccess === undefined ? undefined : (data.onSuccess ?? Prisma.JsonNull),
            onError: data.onError === undefined ? undefined : (data.onError ?? Prisma.JsonNull),
        },
        select,
    })

    await RequestTemplatesCache.invalidateTemplate(id)
    await RequestTemplatesCache.invalidateByCompany(existing.companyId)
    await RequestTemplatesCache.invalidateAll()
    return template
}

export const deleteRequestTemplate = async (id: string) => {
    const existing = await prisma.requestTemplate.findUnique({ where: { id } })
    if (!existing) throw new AppError('Request template not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.requestTemplate.delete({ where: { id } })
    })

    await RequestTemplateRepository.regenerate(existing.companyId)
    await RequestTemplatesCache.invalidateTemplate(id)
    await RequestTemplatesCache.invalidateByCompany(existing.companyId)
    await RequestTemplatesCache.invalidateAll()
}
