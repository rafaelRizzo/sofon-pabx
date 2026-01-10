import { type FastifyReply } from 'fastify'
import { handleError } from '../../utils/handler.error'
import { UserService } from '../../services/user/user.service'

const userService = new UserService();

export const firstUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Check first user creation');
        const user = await userService.createFirstUser(request.body);
        request.log.info('Finishing user creation');

        return reply.code(201).send({
            success: true,
            message: 'Usuário criado com sucesso',
            user
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao criar usuário');
    }
}

export const createUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Creating new user');
        const user = await userService.create(request.body);
        request.log.info('Finishing new user creation');

        return reply.code(201).send({
            success: true,
            message: 'Usuário criado com sucesso',
            user
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao criar usuário');
    }
}

export const listUsers = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Listing users');
        const users = await userService.list();

        return reply.code(200).send({
            success: true,
            users
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao listar usuários');
    }
}

export const getUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Getting user with id: ${request.params.id}`);
        const user = await userService.getById(request.params.id);
        request.log.info('Finishing getting user');

        return reply.code(200).send({
            success: true,
            user: [user]
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao buscar usuário');
    }
}

export const updateUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Updating user with id: ${request.params.id}`);
        await userService.update(request.params.id, request.body);
        request.log.info('Finishing user update');

        return reply.code(200).send({
            success: true,
            message: 'Usuário atualizado com sucesso'
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao atualizar usuário');
    }
}

export const deleteUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Deleting user with id: ${request.params.id}`);
        await userService.delete(request.params.id);
        request.log.info('Finishing user deletion');

        return reply.code(200).send({
            success: true,
            message: 'Usuário deletado com sucesso'
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao deletar usuário');
    }
}