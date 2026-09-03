import { redisClient } from '../config/redis'
import { cacheManager } from '../config/cache'
import { logger } from '../utils/logger'

// Rotina de correção de cache que só precisa rodar uma vez por ambiente (ex: mudou o shape do
// que fica cacheado e o cache antigo, sem TTL, quebraria a validação de response). Cada entrada
// roda no boot do processo worker (singleton, ver server.ts) e marca no próprio Redis que já
// rodou - reboot/deploy seguintes pulam direto. Pra forçar rodar de novo, apague a chave
// `cache-migration:<id>` no Redis.
type CacheMigration = { id: string; run: () => Promise<void> }

const MIGRATIONS: CacheMigration[] = [
    {
        // Adicionado `company: {id, name}` ao select/schema de IntegrationCredential - cache
        // antigo (sem TTL) não tem esse campo e falha a validação Zod de response ("Response
        // doesn't match the schema").
        id: 'integration-credentials-add-company-field',
        run: () => cacheManager.invalidate('integration-credentials'),
    },
    {
        // Adicionados `surveyServiceAudioId`/`hasSurveyAudio`/`callcenterEnabled` ao QueueSchema -
        // cache antigo (sem TTL) não tem esses campos e falha a validação Zod de response
        // ("Response doesn't match the schema").
        id: 'queues-add-callcenter-survey-fields',
        run: () => cacheManager.invalidate('queues'),
    },
    {
        // Adicionado `active` (toggle online/offline do endpoint) ao TrunkSchema - cache antigo
        // (sem TTL) não tem esse campo e falha a validação Zod de response ("Response doesn't
        // match the schema"). Limpa tudo (prefixo `cache:*`) em vez de só `trunks`, pra pegar
        // qualquer outro cache já defasado - cacheManager.clear() nunca toca em `jti:*` (prefixo
        // separado por design, ver config/cache.ts), então sessões logadas não são afetadas.
        id: 'trunks-add-active-field-clear-all',
        run: () => cacheManager.clear(),
    },
]

// Nunca lança - uma falha aqui (ex: Redis instável no boot) não pode derrubar o worker inteiro,
// só deixa a migração pendente pra tentar de novo no próximo boot.
export async function runCacheMigrations() {
    for (const migration of MIGRATIONS) {
        try {
            const markerKey = `cache-migration:${migration.id}`
            const alreadyRan = await redisClient.get(markerKey)
            if (alreadyRan) continue

            await migration.run()
            await redisClient.set(markerKey, new Date().toISOString())
            logger.info({ event: 'cache_migration.applied', id: migration.id })
        } catch (error) {
            logger.error({ event: 'cache_migration.error', id: migration.id, error: error instanceof Error ? error.message : String(error) })
        }
    }
}
