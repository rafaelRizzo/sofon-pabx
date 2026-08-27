import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { REQUEST_TEMPLATE_CONTEXT, requestTemplateExten } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

const env = validateEnv()

const buildAgiUrl = (id: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/run,${id}`

// Dialplan de um RequestTemplate é sempre o mesmo par fixo (AGI + Hangup) - quem varia é o registro
// no banco, lido pelo AGI server em tempo de chamada via o id no agiUrl. Por isso só depende do id
// (nunca muda com method/url/headers/etc - ver RequestTemplatesService).
export const RequestTemplateRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${REQUEST_TEMPLATE_CONTEXT}:${asteriskId}`, async () => {
            const templates = await prisma.requestTemplate.findMany({ where: { companyId }, select: { id: true } })
            const entries: DialplanRow[] = templates.flatMap(({ id }) => {
                const exten = requestTemplateExten(id)
                return [
                    { context: REQUEST_TEMPLATE_CONTEXT, exten, priority: 1, app: 'AGI', appdata: buildAgiUrl(id) },
                    { context: REQUEST_TEMPLATE_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
                ]
            })
            await writeContextFile(REQUEST_TEMPLATE_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
