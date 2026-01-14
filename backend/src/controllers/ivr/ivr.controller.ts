import { BaseController } from '../base/base.controller'
import { handleError } from '../../utils/handler.error'
import { IVRService } from '../../services/ivr/ivr.service'

export class IVRController extends BaseController {
    private ivrService = new IVRService()

    async create() {
        try {
            const ivr = await this.ivrService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'IVR criado com sucesso',
                ivr
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar IVR')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const ivrs = await this.ivrService.list(companyId)

            return this.reply.send({
                success: true,
                ivrs
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar IVRs')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const ivr = await this.ivrService.getById(id)

            return this.reply.send({
                success: true,
                ivrs: [ivr]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar IVR')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            await this.ivrService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'IVR atualizado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar IVR')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.ivrService.delete(id)

            return this.reply.send({
                success: true,
                message: 'IVR deletado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar IVR')
        }
    }
}
