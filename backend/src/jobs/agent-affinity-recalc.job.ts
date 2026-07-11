import { recalculateAffinity } from '../modules/callcenter/affinity/affinity.service'
import { logger } from '../utils/logger'

const INTERVAL_MS = 5 * 60 * 1000

async function runRecalc() {
    const result = await recalculateAffinity()
    if (result.agents > 0) logger.info({ event: 'callcenter.affinity.recalc', ...result })
}

// Roda mais frequente que holiday-resync (diário) — afinidade deve refletir notas recentes rápido,
// e recalcular é barato (poucas linhas por empresa). Mesmo padrão: setInterval puro, roda no boot +
// fixo, fire-and-forget com .catch() em cada execução.
export function startAgentAffinityRecalcJob() {
    runRecalc().catch((error) => logger.error({ event: 'callcenter.affinity.recalc.error', error }))
    setInterval(() => {
        runRecalc().catch((error) => logger.error({ event: 'callcenter.affinity.recalc.error', error }))
    }, INTERVAL_MS)
}
