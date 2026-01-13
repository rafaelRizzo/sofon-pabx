import { BaseController } from '../base/base.controller'
import { UserService } from '../../services/user/user.service'
import { handleError } from '../../utils/handler.error'

export class UserController extends BaseController {
    private userService = new UserService()

    async createFirstUser() {
        try {
            const user = await this.userService.createFirstUser(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Usuário criado com sucesso',
                user
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar usuário')
        }
    }

    async create() {
        try {
            const user = await this.userService.create(this.request.body)

            return this.reply.code(201).send({
                success: true,
                message: 'Usuário criado com sucesso',
                user
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao criar usuário')
        }
    }

    async list() {
        try {
            const users = await this.userService.list()

            return this.reply.send({
                success: true,
                users
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao listar usuários')
        }
    }

    async getById() {
        try {
            const { id } = this.request.params
            const user = await this.userService.getById(id)

            return this.reply.send({
                success: true,
                users: [user]
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao buscar usuário')
        }
    }

    async update() {
        try {
            const { id } = this.request.params
            await this.userService.update(id, this.request.body)

            return this.reply.send({
                success: true,
                message: 'Usuário atualizado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao atualizar usuário')
        }
    }

    async delete() {
        try {
            const { id } = this.request.params
            await this.userService.delete(id)

            return this.reply.send({
                success: true,
                message: 'Usuário deletado com sucesso'
            })
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao deletar usuário')
        }
    }
}
