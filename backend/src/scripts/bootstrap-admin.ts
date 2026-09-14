// Cria o primeiro usuário (role=admin) quando o banco ainda não tem nenhum - mesma regra de
// POST /auth/register (só funciona com COUNT(users) === 0), mas sem precisar da API estar de pé.
// Idempotente: se já existir qualquer User, só loga e sai sem erro - seguro pra rodar em todo
// boot (entrypoint.sh) sem recriar nada. Senha gerada aleatoriamente e impressa uma única vez no
// stdout, nunca persistida em texto puro nem logada de novo depois.
// Rodar manualmente: bun run src/scripts/bootstrap-admin.ts
// Nome/email customizáveis via env: BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL
import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import { prisma } from '../lib/prisma'

const generatePassword = () => randomBytes(18).toString('base64url')

async function main() {
    const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador'
    const username = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@sofonpabx.local'
    const password = generatePassword()
    const hashedPassword = await argon2.hash(password)

    // count + create numa transação serializável, mesma proteção de auth.service.ts:register -
    // evita duas execuções concorrentes (ex: 2 réplicas subindo ao mesmo tempo) criarem 2 admins.
    const created = await prisma.$transaction(
        async (tx) => {
            const userCount = await tx.user.count()
            if (userCount > 0) return null

            return tx.user.create({
                data: { name, username, password: hashedPassword, role: 'admin' },
                select: { id: true, username: true },
            })
        },
        { isolationLevel: 'Serializable' },
    )

    if (!created) {
        const userCount = await prisma.user.count()
        console.log(`Bootstrap ignorado: já existem ${userCount} usuário(s) cadastrado(s).`)
        return
    }

    console.log('Usuário admin criado com sucesso:')
    console.log(`  id:       ${created.id}`)
    console.log(`  username: ${created.username}`)
    console.log(`  password: ${password}`)
    console.log('Guarde essa senha agora - ela não será exibida novamente.')
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => process.exit(0))
