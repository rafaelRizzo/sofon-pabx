import { BaseController } from '../base/base.controller'
import { handleError } from '../../utils/handler.error'
import { TimeRuleService } from '../../services/timeRules/timeRules.service'

export class TimeRulesController extends BaseController {
    private timeRulesService = new TimeRuleService()

    async create() {
        try {
            const timeRules = await this.timeRulesService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Time rule criada com sucesso',
                timeRules
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar time rule')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const timeRules = await this.timeRulesService.list(companyId)

            return this.reply.send({
                success: true,
                timeRules
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar time rules')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const timeRule = await this.timeRulesService.getById(id)

            return this.reply.send({
                success: true,
                timeRules: [timeRule]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar time rule')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            await this.timeRulesService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Time rule atualizada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar time rule')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.timeRulesService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Time rule deletada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar time rule')
        }
    }
}