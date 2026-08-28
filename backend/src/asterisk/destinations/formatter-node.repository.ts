import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { FORMATTER_CONTEXT, formatterExten } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

const env = validateEnv()

const buildAgiUrl = (id: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/format,${id}`

// Mesmo padrão de IxcNodeRepository/RequestTemplateRepository: dialplan de um FormatterNode é
// sempre o mesmo par fixo (AGI + Hangup) - quem varia é o registro no banco (inputVariable/
// outputVariable/masks), lido pelo AGI server em tempo de chamada via o id no agiUrl.
export const FormatterNodeRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${FORMATTER_CONTEXT}:${asteriskId}`, async () => {
            const nodes = await prisma.formatterNode.findMany({ where: { companyId }, select: { id: true } })
            const entries: DialplanRow[] = nodes.flatMap(({ id }) => {
                const exten = formatterExten(id)
                return [
                    { context: FORMATTER_CONTEXT, exten, priority: 1, app: 'AGI', appdata: buildAgiUrl(id) },
                    { context: FORMATTER_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
                ]
            })
            await writeContextFile(FORMATTER_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
