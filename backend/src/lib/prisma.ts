import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '../../generated/prisma/client'
import { auditContext } from './audit-context'
import { logger } from '../utils/logger'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const basePrisma = new PrismaClient({ adapter })

// Recursos de configuração expostos por módulo (ver CLAUDE.md "Estrutura de módulo") — o que um
// usuário efetivamente cria/edita/exclui pela API. Fora da lista: tabelas realtime do Asterisk
// (ps_*, sip_peers, cdr...), que são espelho de escrita interna de outro model já auditado aqui, e
// join tables sem id próprio (UserCompany, OutboundRouteTrunk/Extension, TimeConditionTimeGroup),
// cujo diff não tem valor de auditoria isolado.
const AUDITED_MODELS = new Set([
    'Company', 'User', 'Did', 'Extension', 'Queue', 'QueueMember', 'Trunk',
    'OutboundRoute', 'TimeGroup', 'TimeCondition', 'HolidayGroup', 'InboundRoute',
    'Announcement', 'Audio', 'IvrMenu', 'RequestTemplate', 'VariableSet',
    'VariableCondition', 'IntegrationCredential', 'IxcNode', 'Flow',
    'AgentCompanyScope', 'RoutingRule',
])

const WRITE_ACTIONS: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
    create: 'CREATE',
    update: 'UPDATE',
    upsert: 'UPDATE',
    delete: 'DELETE',
    updateMany: 'UPDATE',
    deleteMany: 'DELETE',
}

const BULK_OPERATIONS = new Set(['updateMany', 'deleteMany'])

// Nunca gravar segredo em claro no log de auditoria, mesmo cifrado (User.password é hash, mas
// sem motivo pra expor; IntegrationCredential.token* já é ciphertext, mas fica de fora por clareza)
const REDACTED_FIELDS: Record<string, string[]> = {
    User: ['password', 'token'],
    IntegrationCredential: ['tokenCiphertext', 'tokenIv', 'tokenTag'],
}

const redact = (model: string, data: any): any => {
    const fields = REDACTED_FIELDS[model]
    if (!fields || !data) return data
    if (Array.isArray(data)) return data.map((row) => redact(model, row))
    const copy = { ...data }
    for (const field of fields) if (field in copy) copy[field] = '[redacted]'
    return copy
}

const resolveActorName = async (userId: string) => {
    const user = await basePrisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    return user?.name ?? null
}

const writeAuditLog = async (entry: {
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    model: string
    recordId: string | null
    companyId: string | null
    before: unknown
    after: unknown
}) => {
    const actor = auditContext.get()
    // sem userId autenticado no contexto (job, script, seed) -> não há "quem" pra registrar
    if (!actor?.userId) return

    if (!actor.userName) actor.userName = await resolveActorName(actor.userId)

    await basePrisma.auditLog
        .create({
            data: {
                actorId: actor.userId,
                actorName: actor.userName,
                ip: actor.ip,
                action: entry.action,
                model: entry.model,
                recordId: entry.recordId,
                companyId: entry.companyId,
                before: (entry.before ?? Prisma.DbNull) as Prisma.InputJsonValue,
                after: (entry.after ?? Prisma.DbNull) as Prisma.InputJsonValue,
            },
        })
        .catch((error: unknown) => {
            logger.error({
                event: 'audit.write_failed',
                model: entry.model,
                error: error instanceof Error ? error.message : String(error),
            })
        })
}

// Escrito fora de um $transaction do caller, então uma escrita auditada que faz parte de uma
// transação que sofre rollback depois ainda gera o registro de auditoria (limitação aceita: os
// services validam tudo antes de abrir $transaction, então isso só acontece em falha de infra).
const prisma = basePrisma.$extends({
    name: 'audit-log',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const action = WRITE_ACTIONS[operation]
                if (!action || model === 'AuditLog' || !AUDITED_MODELS.has(model)) {
                    return query(args)
                }

                const delegate = (basePrisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
                const isBulk = BULK_OPERATIONS.has(operation)
                const where = (args as any)?.where

                let before: any = null
                if (operation === 'update' || operation === 'upsert' || operation === 'delete') {
                    before = await delegate.findUnique({ where }).catch(() => null)
                } else if (isBulk) {
                    before = await delegate.findMany({ where }).catch(() => [])
                }

                const result = await query(args)

                const after = operation === 'delete'
                    ? null
                    : isBulk
                        ? { count: (result as any)?.count ?? null, affectedIds: (before as any[]).map((r) => r.id) }
                        : result

                const recordId = isBulk ? null : ((result as any)?.id ?? where?.id ?? null)
                const companyId = isBulk
                    ? null
                    : ((after as any)?.companyId ?? (before as any)?.companyId ?? null)

                await writeAuditLog({
                    action,
                    model,
                    recordId,
                    companyId,
                    before: redact(model, before),
                    after: redact(model, after),
                })

                return result
            },
        },
    },
})

export { prisma }
