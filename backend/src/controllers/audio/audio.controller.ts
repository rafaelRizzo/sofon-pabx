import { BaseController } from '../base/base.controller'
import { AudioService } from '../../services/audio/audio.service'
import { handleError } from '../../utils/handler.error'

export class AudioController extends BaseController {
    private audioService = new AudioService()

    async create() {
        try {
            const audio = await this.audioService.create(this.request)

            return this.reply.code(201).send({
                success: true,
                message: 'Áudio criado com sucesso',
                data: audio
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar áudio')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const audios = await this.audioService.list(companyId)

            return this.reply.send({
                success: true,
                audios
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar áudios')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const audio = await this.audioService.getById(id)

            return this.reply.send({
                success: true,
                audios: [audio]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar áudio')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.audioService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Áudio deletado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar áudio')
        }
    }

}