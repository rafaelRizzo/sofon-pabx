import { BaseController } from '../base/base.controller'
import { handleError } from '../../utils/handler.error'
import { TimeConditionService } from '../../services/timecondition/timecondition.service'

export class TimeConditionController extends BaseController {
    private timeConditionService = new TimeConditionService()

    async create() {
        try {
            const timeConditions = await this.timeConditionService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Time condition criada com sucesso',
                timeConditions
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar time condition')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const timeConditions = await this.timeConditionService.list(companyId)

            return this.reply.send({
                success: true,
                timeConditions
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar time contiditions')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const timeCondition = await this.timeConditionService.getById(id)

            return this.reply.send({
                success: true,
                timeConditions: [timeCondition]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar time contidition')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            await this.timeConditionService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Time condition atualizada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar time contidition')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.timeConditionService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Time condition deletada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar time contidition')
        }
    }
}