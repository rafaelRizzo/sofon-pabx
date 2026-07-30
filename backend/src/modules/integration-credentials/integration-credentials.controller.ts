import type { FastifyRequest, FastifyReply } from 'fastify'
import * as IntegrationCredentialsService from './integration-credentials.service'
import {
    createIntegrationCredentialSchema, updateIntegrationCredentialSchema, idParamSchema, companyQuerySchema, providerQuerySchema,
} from './schemas/integration-credential.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const getIntegrationCredentials = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        const { provider } = providerQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const integrationCredentials = await IntegrationCredentialsService.getIntegrationCredentialsByCompany(companyId, provider)
        return reply.send({ success: true, message: 'Integration credentials fetched successfully', integrationCredentials })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getIntegrationCredentialById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const integrationCredential = await IntegrationCredentialsService.getIntegrationCredentialById(id)
        req.scope.assertAccess(integrationCredential.companyId)
        return reply.send({ success: true, message: 'Integration credential fetched successfully', integrationCredential })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createIntegrationCredential = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createIntegrationCredentialSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const integrationCredential = await IntegrationCredentialsService.createIntegrationCredential(data)
        return reply.status(201).send({ success: true, message: 'Integration credential created successfully', integrationCredentialId: integrationCredential.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateIntegrationCredential = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateIntegrationCredentialSchema.parse(req.body)
        const existing = await prisma.integrationCredential.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Integration credential not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IntegrationCredentialsService.updateIntegrationCredential(id, data)
        return reply.send({ success: true, message: 'Integration credential updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteIntegrationCredential = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.integrationCredential.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Integration credential not found', 404)
        req.scope.assertAccess(existing.companyId)
        await IntegrationCredentialsService.deleteIntegrationCredential(id)
        return reply.send({ success: true, message: 'Integration credential deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
