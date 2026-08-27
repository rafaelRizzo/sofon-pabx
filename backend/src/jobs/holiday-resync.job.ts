import { resyncAllHolidayGroupsFromUrl } from '../modules/holiday-groups/holiday-groups.service'
import { logger } from '../utils/logger'

const DAY_MS = 24 * 60 * 60 * 1000

async function runSync() {
    const year = new Date().getFullYear()
    const count = await resyncAllHolidayGroupsFromUrl(year)
    if (count > 0) logger.info({ event: 'holidays.resync', year, groups: count })
}

// Só mexe em HolidayGroup com `url` configurada - grupos manuais (sem url) não são tocados por esse
// job, o usuário edita as datas direto pela API. Roda no boot + polling diário: cobre restart e
// uptime longo, e re-tenta a URL caso ela tenha falhado numa rodada anterior. Sem cron externo.
export function startHolidayResyncJob() {
    runSync().catch((error) => logger.error({ event: 'holidays.resync.error', error }))
    setInterval(() => {
        runSync().catch((error) => logger.error({ event: 'holidays.resync.error', error }))
    }, DAY_MS)
}
