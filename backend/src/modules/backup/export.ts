import { readFile } from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { getExtensionById, getExtensionsForExport } from '../extensions/extensions.service'
import { getTrunks } from '../trunks/trunks.service'
import { getDidsByCompany } from '../dids/dids.service'
import { getAudiosByCompany } from '../audios/audios.service'
import { audioSoundPath } from '../../asterisk/audio.repository'
import { decryptForCompany } from '../../lib/crypto'
import { getIxcNodesByCompany } from '../ixc-nodes/ixc-nodes.service'
import { getTimeGroupsByCompany } from '../time-groups/time-groups.service'
import { getQueuesByCompany } from '../queues/queues.service'
import { getQueueMembers } from '../queue-members/queue-members.service'
import { getTimeConditionsByCompany } from '../time-conditions/time-conditions.service'
import { getHolidayGroupsByCompany } from '../holiday-groups/holiday-groups.service'
import { getInboundRoutesByCompany } from '../inbound-routes/inbound-routes.service'
import { getAnnouncementsByCompany } from '../announcements/announcements.service'
import { getIvrMenusByCompany } from '../ivr/ivr.service'
import { getRequestTemplatesByCompany } from '../request-templates/request-templates.service'
import { getVariableSetsByCompany } from '../variables/variables.service'
import { getVariableConditionsByCompany } from '../variable-conditions/variable-conditions.service'
import { getOutboundRoutes } from '../outbound-routes/outbound-routes.service'
import { getScopesByCompany } from '../callcenter/agents/agents.service'
import { getRoutingRulesByCompany } from '../callcenter/routing-rules/routing-rules.service'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { BACKUP_VERSION } from './schemas/backup.schema'

async function exportExtensions(companyId: string) {
    const [ids, withPasswords] = await Promise.all([
        prisma.extension.findMany({ where: { companyId }, select: { id: true } }),
        getExtensionsForExport([companyId])
    ])
    const passwordById = new Map(withPasswords.map((e) => [e.id, e.password]))
    return Promise.all(
        ids.map(async ({ id }) => ({
            ...(await getExtensionById(id)),
            password: passwordById.get(id) ?? null
        }))
    )
}

async function exportAudios(companyId: string, asteriskId: string) {
    // AudiosCache.getByCompany não tipa o retorno cacheado (infere {} sem generic explícito) —
    // o shape real é sempre o de AudioSchema, ver audios.service.ts::select
    const audios = (await getAudiosByCompany(companyId)) as Array<{ id: string; name: string }>
    return Promise.all(
        audios.map(async (a) => {
            const wavBase64 = await readFile(`${audioSoundPath(asteriskId, a.id)}.wav`)
                .then((buf) => buf.toString('base64'))
                .catch(() => null) // arquivo pode ter sido removido do disco fora do fluxo normal
            return { ...a, wavBase64 }
        })
    )
}

async function exportIntegrationCredentials(companyId: string) {
    const rows = await prisma.integrationCredential.findMany({
        where: { companyId },
        select: { id: true, provider: true, name: true, baseUrl: true, tokenCiphertext: true, tokenIv: true, tokenTag: true }
    })
    return rows.map(({ tokenCiphertext, tokenIv, tokenTag, ...rest }) => ({
        ...rest,
        token: decryptForCompany(companyId, { ciphertext: tokenCiphertext, iv: tokenIv, tag: tokenTag })
    }))
}

// Só role="user" vinculado via UserCompany — admin/reseller são conta de plataforma, não dado
// de empresa. password já é o hash argon2 armazenado (ver users.service.ts), restaurado 1:1 sem
// re-hash, então o login continua funcionando com a senha original depois do restore
async function exportUsers(companyId: string) {
    const links = await prisma.userCompany.findMany({
        where: { companyId, user: { role: 'user' } },
        select: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    password: true,
                    status: true,
                    permissions: true,
                    extensionId: true
                }
            }
        }
    })
    return links.map((l) => l.user)
}

async function exportQueues(companyId: string) {
    const queues = await getQueuesByCompany(companyId)
    return Promise.all(
        queues.map(async (q) => ({ ...q, members: await getQueueMembers(q.id) }))
    )
}

async function exportFlows(companyId: string) {
    const flows = await prisma.flow.findMany({ where: { companyId }, select: { id: true, name: true } })
    return Promise.all(
        flows.map(async (f) => {
            const [entryDestination, nodes, edges] = await Promise.all([
                FlowEdgeRepository.getOne('flow', f.id, 'entry'),
                prisma.flowNode.findMany({
                    where: { flowId: f.id },
                    select: { id: true, type: true, resourceId: true, label: true, position: true }
                }),
                prisma.flowNodeEdge.findMany({
                    where: { flowId: f.id },
                    select: { sourceNodeId: true, sourcePort: true, targetNodeId: true }
                })
            ])
            return { id: f.id, name: f.name, entryDestination, nodes, edges }
        })
    )
}

// Mirror do que cada GET já devolve, com 2 acréscimos: bytes de áudio (base64) e token de
// integração decriptado — o resto é o próprio DTO de cada módulo, sem transformação.
export async function exportCompanyBackup(companyId: string) {
    const company = await getCompanyById(companyId)

    const [
        extensions,
        trunks,
        dids,
        audios,
        timeGroups,
        integrationCredentials,
        ixcNodes,
        queues,
        timeConditions,
        holidayGroups,
        inboundRoutes,
        announcements,
        ivrMenus,
        requestTemplates,
        variableSets,
        variableConditions,
        outboundRoutes,
        agentCompanyScopes,
        routingRules,
        flows,
        users
    ] = await Promise.all([
        exportExtensions(companyId),
        getTrunks(companyId),
        getDidsByCompany(companyId),
        exportAudios(companyId, company.asteriskId),
        getTimeGroupsByCompany(companyId),
        exportIntegrationCredentials(companyId),
        getIxcNodesByCompany(companyId),
        exportQueues(companyId),
        getTimeConditionsByCompany(companyId),
        getHolidayGroupsByCompany(companyId),
        getInboundRoutesByCompany(companyId),
        getAnnouncementsByCompany(companyId),
        getIvrMenusByCompany(companyId),
        getRequestTemplatesByCompany(companyId),
        getVariableSetsByCompany(companyId),
        getVariableConditionsByCompany(companyId),
        getOutboundRoutes(companyId),
        getScopesByCompany(companyId),
        getRoutingRulesByCompany(companyId),
        exportFlows(companyId),
        exportUsers(companyId)
    ])

    return {
        company: {
            id: company.id,
            name: company.name,
            doc: company.doc,
            metadata: company.metadata,
            elevenLabsApiKey: company.elevenLabsApiKey,
            timezone: company.timezone
        },
        extensions,
        trunks,
        dids,
        audios,
        timeGroups,
        integrationCredentials,
        ixcNodes,
        queues,
        timeConditions,
        holidayGroups,
        inboundRoutes,
        announcements,
        ivrMenus,
        requestTemplates,
        variableSets,
        variableConditions,
        outboundRoutes,
        agentCompanyScopes,
        routingRules,
        flows,
        users
    }
}

export async function exportBackup(companyId?: string) {
    const companies = companyId
        ? [await exportCompanyBackup(companyId)]
        : await Promise.all(
              (await prisma.company.findMany({ select: { id: true } })).map((c) => exportCompanyBackup(c.id))
          )

    return {
        backupVersion: BACKUP_VERSION,
        generatedAt: new Date().toISOString(),
        companies
    }
}
