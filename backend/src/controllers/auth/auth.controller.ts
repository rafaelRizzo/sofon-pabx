import { type FastifyReply } from 'fastify'
import { handleError } from '../../utils/handler.error'
import { AuthService } from '../../services/auth/auth.service'

const authService = new AuthService();

export const signIn = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Starting sign-in process');

        const token = await authService.signIn(request.body);

        request.log.info('Sign-in successful');

        return reply.status(200).send({
            success: true,
            message: 'Login realizado com sucesso',
            token
        });
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao fazer login');
    }
}