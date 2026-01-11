import { BaseController } from '../base/base.controller';
import { AuthService } from '../../services/auth/auth.service'
import { handleError } from '../../utils/handler.error'

export class AuthController extends BaseController {
    private authService = new AuthService()

    async signIn() {
        try {
            const token = await this.authService.signIn(this.request.body);

            return this.reply.status(200).send({
                success: true,
                message: 'Login realizado com sucesso',
                token
            });
        } catch (error) {
            return handleError(this.request, this.reply, error, 'Erro ao fazer login');
        }
    }
}
