import { BaseController } from '../base/base.controller'
import { InboundRouteService } from '../../services/inboundRoute/inboundRoute.service'
import { handleError } from '../../utils/handler.error'

export class InboundRouteController extends BaseController {
    private inboundRouteService = new InboundRouteService()

    async create() {
        try {
            const inboundRoute = await this.inboundRouteService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Rota de entrada criada com sucesso',
                inboundRoute
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar rota de entrada')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const inboundsRoutes = await this.inboundRouteService.list(companyId)

            return this.reply.send({
                success: true,
                inboundsRoutes
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar rotas de entrada')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const inboundRoute = await this.inboundRouteService.getById(id)

            return this.reply.send({
                success: true,
                inboundsRoutes: [inboundRoute]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar rota de entrada')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            await this.inboundRouteService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Rota de entrada atualizada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar rota de entrada')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.inboundRouteService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Rota de entrada deletada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar rota de entrada')
        }
    }
}