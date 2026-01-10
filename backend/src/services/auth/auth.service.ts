import { prisma } from "../../lib/prisma";
import { comparePassword } from "../../utils/handler.bcrypt";
import { generateToken, isTokenValid } from "../../utils/handler.jwt";

type SignInType = {
    username: string;
    password: string;
}

export class AuthService {
    async signIn(credentials: SignInType) {
        const user = await prisma.user.findUnique({
            where: { username: credentials.username }
        });

        if (!user) {
            throw new Error('Credenciais inválidas');
        }

        const isPasswordValid = await comparePassword(credentials.password, user.password);

        if (!isPasswordValid) {
            throw new Error('Credenciais inválidas');
        }

        let token = user.token;

        // Verifica se token existe e é válido
        if (user.token && isTokenValid(user.token)) {
            // Token existente ainda é válido, reutiliza
            return token;
        } else {
            // Cria novo token
            token = generateToken({
                id: user.id,
                username: user.username,
                role: user.role
            });

            // Atualiza token no banco
            await prisma.user.update({
                where: { id: user.id },
                data: { token }
            });

            return token;
        }
    }
}