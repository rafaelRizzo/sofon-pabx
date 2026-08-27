import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { IXC_NODE_CONTEXT, ixcNodeExten } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

const env = validateEnv()

const buildAgiUrl = (id: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/ixc,${id}`

// Mesmo padrão de RequestTemplateRepository: dialplan de um IxcNode é sempre o mesmo par fixo
// (AGI + Hangup) - quem varia é o registro no banco (action/params/credential), lido pelo AGI
// server em tempo de chamada via o id no agiUrl.
export const IxcNodeRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${IXC_NODE_CONTEXT}:${asteriskId}`, async () => {
            const nodes = await prisma.ixcNode.findMany({ where: { companyId }, select: { id: true } })
            const entries: DialplanRow[] = nodes.flatMap(({ id }) => {
                const exten = ixcNodeExten(id)
                return [
                    { context: IXC_NODE_CONTEXT, exten, priority: 1, app: 'AGI', appdata: buildAgiUrl(id) },
                    { context: IXC_NODE_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
                ]
            })
            await writeContextFile(IXC_NODE_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
