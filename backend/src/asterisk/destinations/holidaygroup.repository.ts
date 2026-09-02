import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { HOL_CONTEXT, holEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

export { HOL_CONTEXT, holEntry }

const env = validateEnv()
const buildAgiUrl = (id: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/holiday,${id}`

export type HolidayDate = { month: number; day: number; year: number | null }

// Compara a data de hoje (já resolvida no timezone da empresa, ver dateInTimeZone) contra as datas
// do grupo - função pura, testável isoladamente. year null = recorrente todo ano (feriado fixo,
// ex: Natal); year preenchido = válido só naquele ano (feriado móvel vindo da API, ex: Carnaval,
// que muda de data ano a ano - GotoIfTime nativo nunca teve campo de ano pra expressar isso).
export function matchesHolidayDate(dates: HolidayDate[], today: { year: number; month: number; day: number }): boolean {
    return dates.some((d) => d.month === today.month && d.day === today.day && (d.year === null || d.year === today.year))
}

// Dialplan de um HolidayGroup é sempre o mesmo par fixo (AGI + Hangup), mesmo padrão de
// VariableConditionRepository - GotoIfTime nativo do Asterisk não dá conta de feriado móvel (sem
// campo de ano), então a checagem roda em JS no AGI server com o ano em mãos (ver handleHolidayCheck
// em agi-server.ts). Quem varia (datas/timezone/rotas) é lido pelo AGI a partir do id no agiUrl.
export const HolidayGroupRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${HOL_CONTEXT}:${asteriskId}`, async () => {
            const groups = await prisma.holidayGroup.findMany({ where: { companyId }, select: { id: true } })
            const entries: DialplanRow[] = groups.flatMap(({ id }) => {
                const exten = holEntry(id)
                return [
                    { context: HOL_CONTEXT, exten, priority: 1, app: 'AGI', appdata: buildAgiUrl(id) },
                    { context: HOL_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
                ]
            })
            await writeContextFile(HOL_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
