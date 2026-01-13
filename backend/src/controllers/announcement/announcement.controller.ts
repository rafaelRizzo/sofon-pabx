import { BaseController } from '../base/base.controller'
import { handleError } from '../../utils/handler.error'
import { AnnouncementService } from '../../services/announcement/announcement.service'

export class AnnouncementController extends BaseController {
    private announcementService = new AnnouncementService()

    async create() {
        try {
            const announcement = await this.announcementService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Anúncio criado com sucesso',
                announcement
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar anúncio')
        }
    }

    async list() {
        try {
            const { companyId } = this.request.query as { companyId?: string }
            const announcements = await this.announcementService.list(companyId)

            return this.reply.send({
                success: true,
                announcements
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar anuncios')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params as { id: string }
            const announcement = await this.announcementService.getById(id)

            return this.reply.send({
                success: true,
                announcements: [announcement]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar anúncio')
        }
    }

    async update() {
        try {
            const { id } = this.request.params as { id: string }
            await this.announcementService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Anúncio atualizado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar anúncio')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params as { id: string }
            await this.announcementService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Anúncio deletado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar anúncio')
        }
    }
}