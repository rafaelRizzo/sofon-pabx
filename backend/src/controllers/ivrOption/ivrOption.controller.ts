import { BaseController } from '../base/base.controller'
import { handleError } from '../../utils/handler.error'
import { IVROptionService } from '../../services/ivrOption/ivrOption.service'

export class IVROptionController extends BaseController {
    private ivrOptionService = new IVROptionService()

    async create() {
        try {
            const option = await this.ivrOptionService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Opção IVR criada com sucesso',
                option
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar opção IVR')
        }
    }

    async list() {
        try {
            const { ivrId, companyId } = this.request.query as {
                ivrId?: string
                companyId?: string
            }
            const ivrOptions = await this.ivrOptionService.list(ivrId, companyId)

            return this.reply.send({
                success: true,
                ivrOptions
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar opções IVR')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const ivrOption = await this.ivrOptionService.getById(id)

            return this.reply.send({
                success: true,
                ivrOptions: [ivrOption]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar opção IVR')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            const option = await this.ivrOptionService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Opção IVR atualizada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar opção IVR')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.ivrOptionService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Opção IVR deletada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar opção IVR')
        }
    }
}