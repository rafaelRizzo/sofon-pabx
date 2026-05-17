import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createDidSchema,
    updateDidSchema,
    idParamSchema,
    companyIdParamSchema,
} from './schemas/dids.schema'
import * as DidService from './dids.service'
import * as CompanyService from '../companies/companies.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

export const getDids = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role, id: userId } = getLoggedUser(req)

        let dids
        if (role === 'admin') {
            dids = await DidService.getAllDids()
        } else {
            dids = await DidService.getDidsByOwnerId(BigInt(userId))
        }

        return reply.send({
            success: true,
            dids,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidsByCompany = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { company_id } = companyIdParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const company = await CompanyService.getCompanyById(company_id)
        if (!company) {
            return reply.status(404).send({
                success: false,
                message: 'Company not found',
            })
        }

        const isAdmin = role === 'admin'
        const isOwner = company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this company DIDs',
            })
        }

        const dids = await DidService.getDidsByCompanyId(company_id)

        return reply.send({
            success: true,
            dids,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getDidById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const did = await DidService.getDidById(id)
        if (!did)
            return reply.status(404).send({
                success: false,
                message: 'DID not found',
            })

        const isAdmin = role === 'admin'
        const company = await CompanyService.getCompanyById(did.company_id)
        const isOwner = company && company.owner_id.toString() === userId

        if (!isAdmin && !isOwner) {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to access this DID',
            })
        }

        return reply.send({
            success: true,
            did,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createDidSchema.parse(req.body)
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(data.company_id)
            if (!company) {
                return reply.status(404).send({
                    success: false,
                    message: 'Company not found',
                })
            }

            const isOwner = company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only create DIDs for your own companies',
                })
            }
        }

        const did = await DidService.createDid(data, isAdmin)

        if (!did) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create DID',
            })
        }

        return reply.status(201).send({
            success: true,
            message: 'DID created successfully',
            did_id: did.id,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateDidSchema.parse(req.body)
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const existingDid = await DidService.getDidById(id)
        if (!existingDid) {
            return reply.status(404).send({
                success: false,
                message: 'DID not found',
            })
        }

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(existingDid.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only update DIDs in your own companies',
                })
            }
        }

        await DidService.updateDid(id, data, isAdmin)

        return reply.send({
            success: true,
            message: 'DID updated successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteDid = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: userId } = getLoggedUser(req)

        const isAdmin = role === 'admin'
        const did = await DidService.getDidById(id)
        if (!did)
            return reply.status(404).send({
                success: false,
                message: 'DID not found',
            })

        if (!isAdmin) {
            const company = await CompanyService.getCompanyById(did.company_id)
            const isOwner = company && company.owner_id.toString() === userId

            if (!isOwner) {
                return reply.status(403).send({
                    success: false,
                    message: 'You can only delete DIDs in your own companies',
                })
            }
        }

        const deletedDid = await DidService.deleteDid(id, isAdmin)
        if (!deletedDid)
            return reply.status(404).send({
                success: false,
                message: 'DID not found',
            })

        return reply.send({
            success: true,
            message: 'DID deleted successfully',
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
