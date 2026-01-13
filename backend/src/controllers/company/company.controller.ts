import { BaseController } from '../base/base.controller'
import { CompanyService } from '../../services/company/company.service'
import { handleError } from '../../utils/handler.error'

export class CompanyController extends BaseController {
    private companyService = new CompanyService()

    async create() {
        try {
            const company = await this.companyService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Empresa criada com sucesso',
                company
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar empresa')
        }
    }

    async list() {
        try {
            const companies = await this.companyService.list()

            return this.reply.send({
                success: true,
                companies
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar empresas')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params
            const company = await this.companyService.getById(id)

            return this.reply.send({
                success: true,
                companies: [company]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar empresa')
        }
    }

    async update() {
        try {
            const { id } = this.request.params
            await this.companyService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Empresa atualizada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar empresa')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params
            await this.companyService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Empresa deletada com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar empresa')
        }
    }
}
