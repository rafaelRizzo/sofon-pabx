import { prisma } from '../../lib/prisma'
import { createCompany, deleteCompany } from '../companies/companies.service'
import { createExtension } from '../extensions/extensions.service'
import { sipReadableFieldKeys, pjsipFieldKeys, createExtensionSchema } from '../extensions/schemas/extension.schema'
import { createTrunk } from '../trunks/trunks.service'
import { createTrunkSchema } from '../trunks/schemas/trunk.schema'
import { createDid } from '../dids/dids.service'
import { createDidSchema } from '../dids/schemas/did.schema'
import { createAudio } from '../audios/audios.service'
import { createIntegrationCredential } from '../integration-credentials/integration-credentials.service'
import { createIntegrationCredentialSchema } from '../integration-credentials/schemas/integration-credential.schema'
import { createTimeGroup } from '../time-groups/time-groups.service'
import { createTimeGroupSchema } from '../time-groups/schemas/time-group.schema'
import { createScope } from '../callcenter/agents/agents.service'
import { createAgentScopeSchema } from '../callcenter/agents/schemas/agent-scope.schema'
import { createIxcNode, updateIxcNode } from '../ixc-nodes/ixc-nodes.service'
import { createIxcNodeSchema } from '../ixc-nodes/schemas/ixc-node.schema'
import { createQueue, updateQueue } from '../queues/queues.service'
import { createQueueSchema } from '../queues/schemas/queue.schema'
import { addMember } from '../queue-members/queue-members.service'
import { addMemberSchema } from '../queue-members/schemas/queue-member.schema'
import { createTimeCondition, updateTimeCondition } from '../time-conditions/time-conditions.service'
import { createTimeConditionSchema } from '../time-conditions/schemas/time-condition.schema'
import { createHolidayGroup, updateHolidayGroup } from '../holiday-groups/holiday-groups.service'
import { createHolidayGroupSchema } from '../holiday-groups/schemas/holiday-group.schema'
import { createInboundRoute, updateInboundRoute } from '../inbound-routes/inbound-routes.service'
import { createInboundRouteSchema } from '../inbound-routes/schemas/inbound-route.schema'
import { createAnnouncement, updateAnnouncement } from '../announcements/announcements.service'
import { createAnnouncementSchema } from '../announcements/schemas/announcement.schema'
import { createIvrMenu, updateIvrMenu } from '../ivr/ivr.service'
import { createIvrMenuSchema } from '../ivr/schemas/ivr.schema'
import { createRequestTemplate, updateRequestTemplate } from '../request-templates/request-templates.service'
import { createRequestTemplateSchema } from '../request-templates/schemas/request-template.schema'
import { createVariableSet, updateVariableSet } from '../variables/variables.service'
import { createVariableSetSchema } from '../variables/schemas/variable.schema'
import { createVariableCondition, updateVariableCondition } from '../variable-conditions/variable-conditions.service'
import { createVariableConditionSchema } from '../variable-conditions/schemas/variable-condition.schema'
import { createOutboundRoute } from '../outbound-routes/outbound-routes.service'
import { createOutboundRouteSchema } from '../outbound-routes/schemas/outbound-route.schema'
import { createRoutingRule } from '../callcenter/routing-rules/routing-rules.service'
import { createRoutingRuleSchema } from '../callcenter/routing-rules/schemas/routing-rule.schema'
import { createFlow, updateFlow } from '../flows/flows.service'
import { createFlowNode, batchFlowNodeEdges } from '../flows/flow-nodes.service'
import { createCompanySchema } from '../companies/schemas/company.schema'
import { AppError } from '../../utils/errors/app.error'
import { type IdMap, mapId, mapIdOptional, remapDestination, remapResourceId, hasDestination } from '../../utils/id-remap'

type Raw = Record<string, any>
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v : [])

export type RestoreCompanyResult = {
    originalName: string
    newCompanyId?: string
    error?: string
    // usuário pulado (username já existe) não derruba o restore da empresa - cada linha aqui é
    // um aviso não-fatal, diferente de `error` (que aborta a empresa inteira)
    userWarnings?: string[]
}

// Cada empresa do backup é restaurada isoladamente: se qualquer passo falhar, a empresa criada
// nesta mesma operação é apagada (cascade cobre tudo) e o erro é reportado só pra ela - as demais
// empresas do arquivo continuam sendo restauradas.
export async function restoreBackup(companies: Raw[], userId: string, generatedAt: string): Promise<RestoreCompanyResult[]> {
    const results: RestoreCompanyResult[] = []
    for (const raw of companies) {
        const originalName = typeof raw?.company?.name === 'string' ? raw.company.name : '(desconhecido)'
        try {
            const { newCompanyId, userWarnings } = await restoreOneCompany(raw, userId, generatedAt)
            results.push({ originalName, newCompanyId, userWarnings: userWarnings.length ? userWarnings : undefined })
        } catch (error) {
            results.push({
                originalName,
                error: error instanceof AppError ? error.message : error instanceof Error ? error.message : String(error)
            })
        }
    }
    return results
}

async function restoreOneCompany(
    raw: Raw,
    userId: string,
    generatedAt: string
): Promise<{ newCompanyId: string; userWarnings: string[] }> {
    const companyInput = createCompanySchema.parse({
        name: raw.company?.name,
        doc: raw.company?.doc ?? undefined,
        metadata: raw.company?.metadata ?? {},
        elevenLabsApiKey: raw.company?.elevenLabsApiKey ?? undefined,
        timezone: raw.company?.timezone ?? undefined
    })

    // Company.name não tem @@unique no schema (múltiplas empresas podiam legitimamente compartilhar
    // nome antes desta feature) - sem esse guard, restaurar o mesmo backup 2x (ou um backup antigo
    // de uma empresa que já existe) criaria uma cópia duplicada silenciosa a cada vez
    const existing = await prisma.company.findFirst({ where: { name: companyInput.name }, select: { id: true } })
    if (existing)
        throw new AppError(
            `Empresa "${companyInput.name}" já existe (id ${existing.id}) - restore cancelado pra essa empresa. Renomeie ou apague a empresa existente antes de restaurar este backup.`,
            409
        )

    const company = await createCompany(companyInput, userId)

    let userWarnings: string[] = []
    try {
        userWarnings = await restoreCompanyEntities(raw, company.id)
    } catch (error) {
        // Se a limpeza da empresa parcialmente criada também falhar, isso NÃO pode ser engolido
        // silenciosamente - o admin precisa saber que sobrou uma empresa "pela metade" no banco
        // pra remover manualmente, senão o erro reportado (só o da causa original) sugere que
        // nada foi criado quando na verdade ficou lixo
        const cleanupFailed = await deleteCompany(company.id).then(
            () => false,
            () => true
        )
        const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : String(error)
        if (cleanupFailed) {
            throw new AppError(
                `${message} - além disso, a limpeza automática da empresa criada parcialmente (id ${company.id}) também falhou. Remova-a manualmente antes de tentar restaurar de novo.`,
                500
            )
        }
        throw error
    }

    // Cada entidade criada durante o restore já vira uma linha de audit log automática (extensão
    // do Prisma em lib/prisma.ts) - este registro extra é só um resumo fácil de achar ("essa
    // empresa nasceu de um restore, a partir deste backup"), não substitui as linhas granulares
    await prisma.auditLog
        .create({
            data: {
                actorId: userId,
                action: 'RESTORE',
                model: 'Backup',
                recordId: company.id,
                companyId: company.id,
                after: { originalName: companyInput.name, sourceGeneratedAt: generatedAt }
            }
        })
        .catch(() => {})

    return { newCompanyId: company.id, userWarnings }
}

async function restoreCompanyEntities(raw: Raw, companyId: string): Promise<string[]> {
    const idMap: IdMap = new Map()
    const deferred: Array<() => Promise<void>> = []

    // ─── Fase 1a: entidades que só dependem da empresa ─────────────────────────

    for (const ext of arr(raw.extensions)) {
        const fieldKeys = ext.type === 'sip' ? sipReadableFieldKeys : pjsipFieldKeys
        const typeFields: Raw = {}
        for (const key of fieldKeys) if (ext[key] !== undefined) typeFields[key] = ext[key]
        const payload = createExtensionSchema.parse({
            alias: ext.alias,
            name: ext.name,
            companyId,
            context: ext.context,
            allowOutbound: ext.allowOutbound,
            type: ext.type,
            ...typeFields
        })
        const created = await createExtension(payload)
        idMap.set(`extension:${ext.id}`, created.id)
    }

    // username é único globalmente (não por empresa) - colisão pula só aquele usuário (vira
    // warning) em vez de abortar a empresa inteira, mesmo espírito do guard de Company.name.
    // password já é hash argon2 do arquivo, restaurado direto sem re-hash (ver export.ts)
    const userWarnings: string[] = []
    for (const u of arr(raw.users)) {
        const username = typeof u.username === 'string' ? u.username : undefined
        if (!username) continue
        const existingUser = await prisma.user.findUnique({ where: { username }, select: { id: true } })
        if (existingUser) {
            userWarnings.push(`Usuário "${username}" já existe (id ${existingUser.id}) - não restaurado.`)
            continue
        }
        try {
            await prisma.user.create({
                data: {
                    name: u.name,
                    username,
                    password: u.password,
                    role: 'user',
                    status: u.status ?? 'active',
                    permissions: Array.isArray(u.permissions) ? u.permissions : [],
                    extensionId: mapIdOptional(idMap, 'extension', u.extensionId ?? null),
                    companies: { create: [{ companyId }] }
                }
            })
        } catch (error) {
            userWarnings.push(
                `Usuário "${username}" falhou: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    for (const t of arr(raw.trunks)) {
        const payload = createTrunkSchema.parse({
            name: t.name,
            companyId,
            type: t.type,
            registrationMode: t.registrationMode,
            codecs: t.codecs,
            techPrefix: t.techPrefix ?? undefined,
            maxInChannels: t.maxInChannels ?? undefined,
            maxOutChannels: t.maxOutChannels ?? undefined,
            host: t.host ?? undefined,
            port: t.port ?? undefined,
            username: t.username ?? undefined,
            password: t.password ?? undefined,
            context: t.registrationMode === 'custom' ? t.context : undefined,
            transport: t.transport ?? undefined,
            dtmfMode: t.dtmfMode ?? undefined,
            directMedia: t.directMedia ?? undefined,
            qualifyFrequency: t.qualifyFrequency ?? undefined,
            qualifyTimeout: t.qualifyTimeout ?? undefined,
            outboundProxy: t.outboundProxy ?? undefined,
            iceSupport: t.iceSupport ?? undefined,
            rel: t.rel ?? undefined,
            timers: t.timers ?? undefined,
            timersMinSe: t.timersMinSe ?? undefined,
            timersSessExpires: t.timersSessExpires ?? undefined,
            sendDiversion: t.sendDiversion ?? undefined,
            customHeaders: t.customHeaders ?? undefined,
            qualify: t.qualify ?? undefined,
            trunkMode: t.trunkMode ?? undefined,
            encryption: t.encryption ?? undefined,
            transfer: t.transfer ?? undefined,
            jitterbuffer: t.jitterbuffer ?? undefined
        })
        const created = await createTrunk(payload)
        idMap.set(`trunk:${t.id}`, created.id)
    }

    for (const d of arr(raw.dids)) {
        const created = await createDid(createDidSchema.parse({ number: d.number, companyId }))
        idMap.set(`did:${d.id}`, created.id)
    }

    for (const a of arr(raw.audios)) {
        if (!a.wavBase64) continue // arquivo já estava ausente no momento do export - sem o que restaurar
        const buffer = Buffer.from(a.wavBase64, 'base64')
        const created = await createAudio(companyId, a.name, buffer, 'restore.wav')
        idMap.set(`audio:${a.id}`, created.id)
    }

    for (const c of arr(raw.integrationCredentials)) {
        const created = await createIntegrationCredential(
            createIntegrationCredentialSchema.parse({ provider: c.provider, name: c.name, companyId, baseUrl: c.baseUrl, token: c.token })
        )
        idMap.set(`integrationCredential:${c.id}`, created.id)
    }

    for (const tg of arr(raw.timeGroups)) {
        const created = await createTimeGroup(
            createTimeGroupSchema.parse({
                name: tg.name,
                companyId,
                ranges: arr(tg.ranges).map((r) => ({
                    startTime: r.startTime,
                    endTime: r.endTime,
                    weekdays: r.weekdays,
                    monthdays: r.monthdays,
                    months: r.months
                }))
            })
        )
        idMap.set(`timeGroup:${tg.id}`, created.id)
    }

    // ─── Fase 1b: dependem só do que já foi criado acima ───────────────────────

    for (const s of arr(raw.agentCompanyScopes)) {
        await createScope(
            createAgentScopeSchema.parse({ extensionId: mapId(idMap, 'extension', s.extensionId), companyId, active: s.active })
        )
    }

    for (const n of arr(raw.ixcNodes)) {
        const created = await createIxcNode(
            createIxcNodeSchema.parse({
                name: n.name,
                companyId,
                credentialId: mapId(idMap, 'integrationCredential', n.credentialId),
                action: n.action,
                params: n.params ?? undefined,
                timeoutMs: n.timeoutMs,
                variableMappings: n.variableMappings ?? []
            })
        )
        idMap.set(`ixcNode:${n.id}`, created.id)
        if (hasDestination(n.onSuccess) || hasDestination(n.onError)) {
            deferred.push(() =>
                updateIxcNode(created.id, {
                    onSuccess: remapDestination(idMap, n.onSuccess) ?? undefined,
                    onError: remapDestination(idMap, n.onError) ?? undefined
                }).then(() => undefined)
            )
        }
    }

    const queueMembersToRestore: Array<{ newQueueId: string; members: Raw[] }> = []
    for (const q of arr(raw.queues)) {
        const created = await createQueue(
            createQueueSchema.parse({
                name: q.name,
                number: q.number,
                companyId,
                strategy: q.strategy,
                musicOnHold: q.musicOnHold,
                timeout: q.timeout,
                retry: q.retry,
                maxLen: q.maxLen,
                wrapupTime: q.wrapupTime,
                announce: mapIdOptional(idMap, 'audio', q.announce) ?? undefined,
                announceFrequency: q.announceFrequency,
                announcePosition: q.announcePosition,
                periodicAnnounce: mapIdOptional(idMap, 'audio', q.periodicAnnounce) ?? undefined,
                periodicAnnounceFrequency: q.periodicAnnounceFrequency,
                agentAnnounce: mapIdOptional(idMap, 'audio', q.agentAnnounce) ?? undefined,
                joinEmpty: q.joinEmpty,
                leaveWhenEmpty: q.leaveWhenEmpty,
                weight: q.weight,
                surveyAudioId: mapIdOptional(idMap, 'audio', q.surveyAudioId) ?? undefined,
                callcenterEnabled: q.callcenterEnabled
            })
        )
        idMap.set(`queue:${q.id}`, created.id)
        if (hasDestination(q.postQueueDestination)) {
            deferred.push(() =>
                updateQueue(created.id, { postQueueDestination: remapDestination(idMap, q.postQueueDestination) ?? undefined }).then(
                    () => undefined
                )
            )
        }
        queueMembersToRestore.push({ newQueueId: created.id, members: arr(q.members) })
    }

    for (const tc of arr(raw.timeConditions)) {
        const created = await createTimeCondition(
            createTimeConditionSchema.parse({
                name: tc.name,
                companyId,
                groupIds: arr(tc.timeGroups).map((g) => mapId(idMap, 'timeGroup', g.timeGroup.id))
            })
        )
        idMap.set(`timeCondition:${tc.id}`, created.id)
        if (hasDestination(tc.trueRoute) || hasDestination(tc.falseRoute)) {
            deferred.push(() =>
                updateTimeCondition(created.id, {
                    trueRoute: remapDestination(idMap, tc.trueRoute) ?? undefined,
                    falseRoute: remapDestination(idMap, tc.falseRoute) ?? undefined
                }).then(() => undefined)
            )
        }
    }

    for (const hg of arr(raw.holidayGroups)) {
        const created = await createHolidayGroup(
            createHolidayGroupSchema.parse({
                name: hg.name,
                companyId,
                url: hg.url ?? undefined,
                dates: hg.url ? undefined : arr(hg.dates).map((d) => ({ name: d.name, month: d.month, day: d.day }))
            })
        )
        idMap.set(`holidayGroup:${hg.id}`, created.id)
        if (hasDestination(hg.trueRoute) || hasDestination(hg.falseRoute)) {
            deferred.push(() =>
                updateHolidayGroup(created.id, {
                    trueRoute: remapDestination(idMap, hg.trueRoute) ?? undefined,
                    falseRoute: remapDestination(idMap, hg.falseRoute) ?? undefined
                }).then(() => undefined)
            )
        }
    }

    for (const an of arr(raw.announcements)) {
        const created = await createAnnouncement(
            createAnnouncementSchema.parse({ name: an.name, companyId, audioId: mapIdOptional(idMap, 'audio', an.audioId) ?? undefined })
        )
        idMap.set(`announcement:${an.id}`, created.id)
        if (hasDestination(an.destination)) {
            deferred.push(() =>
                updateAnnouncement(created.id, { destination: remapDestination(idMap, an.destination) ?? undefined }).then(() => undefined)
            )
        }
    }

    for (const ivr of arr(raw.ivrMenus)) {
        const created = await createIvrMenu(
            createIvrMenuSchema.parse({
                name: ivr.name,
                companyId,
                type: ivr.type,
                variableName: ivr.variableName ?? undefined,
                audioId: mapIdOptional(idMap, 'audio', ivr.audioId) ?? undefined,
                maxDigits: ivr.maxDigits,
                digitTimeout: ivr.digitTimeout,
                invalidRetries: ivr.invalidRetries,
                timeoutRetries: ivr.timeoutRetries,
                options: [] // opções (com destino) são religadas na fase 2, ver abaixo
            })
        )
        idMap.set(`ivrMenu:${ivr.id}`, created.id)
        const options = arr(ivr.options)
        if (
            options.length > 0 ||
            hasDestination(ivr.invalidDestination) ||
            hasDestination(ivr.timeoutDestination) ||
            hasDestination(ivr.longDestination)
        ) {
            deferred.push(() =>
                updateIvrMenu(created.id, {
                    invalidDestination: remapDestination(idMap, ivr.invalidDestination) ?? undefined,
                    timeoutDestination: remapDestination(idMap, ivr.timeoutDestination) ?? undefined,
                    longDestination: remapDestination(idMap, ivr.longDestination) ?? undefined,
                    options: options.map((o) => ({ digit: o.digit, destination: remapDestination(idMap, o.destination) ?? undefined }))
                }).then(() => undefined)
            )
        }
    }

    for (const rt of arr(raw.requestTemplates)) {
        const created = await createRequestTemplate(
            createRequestTemplateSchema.parse({
                name: rt.name,
                companyId,
                method: rt.method,
                url: rt.url,
                headers: rt.headers ?? undefined,
                body: rt.body ?? undefined,
                timeoutMs: rt.timeoutMs,
                variableMappings: rt.variableMappings ?? []
            })
        )
        idMap.set(`requestTemplate:${rt.id}`, created.id)
        if (hasDestination(rt.onSuccess) || hasDestination(rt.onError)) {
            deferred.push(() =>
                updateRequestTemplate(created.id, {
                    onSuccess: remapDestination(idMap, rt.onSuccess) ?? undefined,
                    onError: remapDestination(idMap, rt.onError) ?? undefined
                }).then(() => undefined)
            )
        }
    }

    for (const vs of arr(raw.variableSets)) {
        const created = await createVariableSet(
            createVariableSetSchema.parse({
                name: vs.name,
                companyId,
                assignments: arr(vs.assignments).map((a) => ({ variable: a.variable, value: a.value }))
            })
        )
        idMap.set(`variableSet:${vs.id}`, created.id)
        if (hasDestination(vs.destination)) {
            deferred.push(() =>
                updateVariableSet(created.id, { destination: remapDestination(idMap, vs.destination) ?? undefined }).then(() => undefined)
            )
        }
    }

    for (const vc of arr(raw.variableConditions)) {
        const created = await createVariableCondition(
            createVariableConditionSchema.parse({
                name: vc.name,
                companyId,
                combinator: vc.combinator,
                rules: arr(vc.rules).map((r) => ({ variable: r.variable, operator: r.operator, value: r.value }))
            })
        )
        idMap.set(`variableCondition:${vc.id}`, created.id)
        if (hasDestination(vc.trueRoute) || hasDestination(vc.falseRoute)) {
            deferred.push(() =>
                updateVariableCondition(created.id, {
                    trueRoute: remapDestination(idMap, vc.trueRoute) ?? undefined,
                    falseRoute: remapDestination(idMap, vc.falseRoute) ?? undefined
                }).then(() => undefined)
            )
        }
    }

    for (const ir of arr(raw.inboundRoutes)) {
        const created = await createInboundRoute(
            createInboundRouteSchema.parse({
                name: ir.name,
                companyId,
                didId: mapId(idMap, 'did', ir.didId),
                trunkId: mapId(idMap, 'trunk', ir.trunkId)
            })
        )
        idMap.set(`inboundRoute:${ir.id}`, created.id)
        if (hasDestination(ir.destination)) {
            deferred.push(() =>
                updateInboundRoute(created.id, { destination: remapDestination(idMap, ir.destination) ?? undefined }).then(() => undefined)
            )
        }
    }

    for (const or_ of arr(raw.outboundRoutes)) {
        const newRouteId = await createOutboundRoute(
            createOutboundRouteSchema.parse({
                name: or_.name,
                companyId,
                position: or_.position,
                trunkIds: arr(or_.trunks).map((t) => mapId(idMap, 'trunk', t.trunkId)),
                patterns: arr(or_.patterns).map((p) => ({ pattern: p.pattern, prefix: p.prefix, prepend: p.prepend, position: p.position })),
                extensionIds: arr(or_.extensions).map((e) => mapId(idMap, 'extension', e.extensionId))
            })
        )
        idMap.set(`outboundRoute:${or_.id}`, newRouteId)
    }

    for (const rr of arr(raw.routingRules)) {
        await createRoutingRule(
            createRoutingRuleSchema.parse({
                name: rr.name,
                companyId,
                priority: rr.priority,
                active: rr.active,
                conditions: {
                    ...rr.conditions,
                    trunkId: rr.conditions?.trunkId ? mapId(idMap, 'trunk', rr.conditions.trunkId) : undefined
                }
            })
        )
    }

    // Membros de fila depois de AgentCompanyScope - addMember() rejeita a extensão se a empresa
    // já tiver algum scope cadastrado e ela não tiver um scope ativo (ver queue-members.service.ts)
    for (const { newQueueId, members } of queueMembersToRestore) {
        for (const m of members) {
            await addMember(
                newQueueId,
                addMemberSchema.parse({ extensionId: mapId(idMap, 'extension', m.extensionId), penalty: m.penalty, paused: m.paused })
            )
        }
    }

    // ─── Fase 1c: Flows - por último, todo recurso que um FlowNode possa referenciar já existe ──

    for (const f of arr(raw.flows)) {
        const created = await createFlow({ name: f.name, companyId })
        idMap.set(`flow:${f.id}`, created.id)
    }
    for (const f of arr(raw.flows)) {
        const newFlowId = mapId(idMap, 'flow', f.id)
        const nodeIdMap = new Map<string, string>()
        for (const n of arr(f.nodes)) {
            const createdNode = await createFlowNode(newFlowId, {
                type: n.type,
                resourceId: remapResourceId(idMap, n.type, n.resourceId),
                label: n.label ?? undefined,
                position: n.position
            })
            nodeIdMap.set(n.id, createdNode.id)
        }
        const edges = arr(f.edges)
        if (edges.length > 0) {
            await batchFlowNodeEdges(
                newFlowId,
                edges.map((e) => {
                    const sourceNodeId = nodeIdMap.get(e.sourceNodeId)
                    const targetNodeId = nodeIdMap.get(e.targetNodeId)
                    if (!sourceNodeId || !targetNodeId)
                        throw new AppError(`Backup restore: aresta de Flow referencia nó inexistente (flow ${f.id})`, 400)
                    return { type: 'connect' as const, sourceNodeId, sourcePort: e.sourcePort, targetNodeId }
                })
            )
        }
        if (hasDestination(f.entryDestination)) {
            deferred.push(() => updateFlow(newFlowId, { entryDestination: remapDestination(idMap, f.entryDestination) ?? undefined }).then(() => undefined))
        }
    }

    // ─── Fase 2: religa todo destino adiado, agora que todo id já existe no mapa ───────────────

    for (const replay of deferred) await replay()

    return userWarnings
}
