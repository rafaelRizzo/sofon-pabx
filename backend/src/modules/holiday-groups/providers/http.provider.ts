import { logger } from '../../../utils/logger'
import { safeFetch } from '../../../utils/net/safe-url'

const TIMEOUT_MS = 3000

// Shape esperado da URL configurada em HolidayGroup.url - mesmo contrato da BrasilAPI
// (https://brasilapi.com.br/api/feriados/v1/{ano}): [{ date: "YYYY-MM-DD", name, type? }]
type ApiHoliday = { date: string; name: string; type?: string }

export type RemoteHoliday = { name: string; month: number; day: number; year: number }

// Busca os feriados do ano numa URL externa (BrasilAPI, custom, o que o usuário configurar em
// HolidayGroup.url) - usado só pelo job de resync (src/jobs/holiday-resync.job.ts). Retorna null em
// qualquer falha (rede, timeout, resposta inválida); quem chama decide o que fazer no fallback.
export async function fetchHolidaysFromUrl(baseUrl: string, year: number): Promise<RemoteHoliday[] | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
        const target = `${baseUrl.replace(/\/$/, '')}/${year}`
        const res = await safeFetch(target, { signal: controller.signal })
        if (!res.ok) {
            logger.warn({ event: 'holidays.provider.error', url: baseUrl, status: res.status })
            return null
        }

        const data = (await res.json()) as ApiHoliday[]
        if (!Array.isArray(data) || data.length === 0) return null

        return data.map((h) => {
            // captura o ano do próprio dígito da data (não o `year` pedido na URL) - feriado móvel
            // (Carnaval, Sexta-feira Santa) precisa desse ano pra bater certo na checagem via AGI
            // (ver matchesHolidayDate em holidaygroup.repository.ts), GotoIfTime nunca teve esse campo
            const [year, month, day] = h.date.split('-').map(Number)
            return { name: h.name, month: month!, day: day!, year: year! }
        })
    } catch (error) {
        logger.warn({ event: 'holidays.provider.error', url: baseUrl, error: error instanceof Error ? error.message : String(error) })
        return null
    } finally {
        clearTimeout(timeout)
    }
}
