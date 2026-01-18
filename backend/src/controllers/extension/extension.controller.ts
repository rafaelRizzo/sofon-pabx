import { BaseController } from '../base/base.controller'
import { ExtensionService } from '../../services/extension/extension.service'
import { handleError } from '../../utils/handler.error'

export class ExtensionController extends BaseController {
    private extensionService = new ExtensionService()

    async create() {
        try {
            const extension = await this.extensionService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Ramal criado com sucesso',
                extension
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar ramal')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query

            const extensions = await this.extensionService.list(companyId)

            return this.reply.send({
                success: true,
                extensions
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar ramais')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params
            const extension = await this.extensionService.getById(id)

            return this.reply.send({
                success: true,
                extensions: [extension]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar ramal')
        }
    }

    async update() {
        try {
            const { id } = this.request.params
            const extension = await this.extensionService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Ramal atualizado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar ramal')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params
            await this.extensionService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Ramal deletado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar ramal')
        }
    }
}