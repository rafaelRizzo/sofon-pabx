import { prisma } from '../../lib/prisma'
import { redisClient } from '../../config/redis'
import { logger } from '../../utils/logger'
import { extKey } from './realtime-keys'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'
import { parseMemberInterface, QUEUE_APP_CONTEXT, queueAppExten } from '../destinations/queue.repository'
import { TRUNK_ROUTED_CONTEXT, routedExten } from '../destinations/inboundroute.repository'
import { extenPatternMatches } from '../dialplan/exten-pattern'
import { FLOW_NODE_CONTEXT, SURVEY_CONTEXT, surveyExten, ROUTING_TRUNK_VAR, flowNodeExitExten } from '../dialplan/dialplan-names'
import { FLOW_NODE_ID_VAR } from '../flows/flow-node-runtime'
import { safeFetch } from '../../utils/net/safe-url'
import { resolveActiveRule } from '../../modules/callcenter/routing-rules/routing-rules.service'
import { createRating } from '../../modules/callcenter/ratings/ratings.service'
import { finalizeByQueueStatus } from '../../modules/queue-calls/queue-calls.service'
import type { VariableMapping } from '../../modules/request-templates/schemas/request-template.schema'
import { decryptForCompany } from '../../lib/crypto'
import { runIxcAction, type IxcAction } from '../../integrations/ixc/client'
import { getIntegrationCredentialForCall } from '../../modules/integration-credentials/integration-credentials.service'
import { evaluateRule, evaluateRules, type VariableRule, type Combinator } from '../destinations/variablecondition.repository'
import { matchesHolidayDate } from '../destinations/holidaygroup.repository'
import { applyMask } from '../../utils/format-mask'
import { dateInTimeZone } from '../../utils/timezone'
import { RequestTemplatesCache } from '../../modules/request-templates/cache/request-templates.cache'
import { IxcNodesCache } from '../../modules/ixc-nodes/cache/ixc-nodes.cache'
import { VariableConditionsCache } from '../../modules/variable-conditions/cache/variable-conditions.cache'
import { HolidayGroupsCache } from '../../modules/holiday-groups/cache/holiday-groups.cache'
import { TimeConditionsCache } from '../../modules/time-conditions/cache/time-conditions.cache'
import { FormatterNodesCache } from '../../modules/formatter-nodes/cache/formatter-nodes.cache'

// Servidor FastAGI - Asterisk conecta via AGI(agi://AGI_HOST:AGI_PORT/<script>,<args>) em vários pontos:
// - /run,<requestTemplateId> - RouteDestination type: "request"
// - /ixc,<ixcNodeId>         - RouteDestination type: "ixc"
// - /varcond,<variableConditionId> - RouteDestination type: "variable-condition" (regras avaliadas
//   em JS puro, ver evaluateRule - motivo em variablecondition.repository.ts)
// - /holiday,<holidayGroupId> - RouteDestination type: "holiday" (month/day/year avaliados em JS,
//   ver matchesHolidayDate - GotoIfTime nativo não tem campo de ano, não dá conta de feriado móvel)
// - /tc,<timeConditionId>    - só loga no console (VERBOSE) os períodos configurados antes do
//   GotoIfTime nativo (priority seguinte, ver timecondition.repository.ts) - avaliação continua 100%
//   nativa, esse hop não decide nada nem faz Goto
// - /format,<formatterNodeId> - RouteDestination type: "formatter" (aplica máscara via
//   applyMask, ver src/utils/format-mask.ts)
// - /queue-route,<queueId>   - antes do Queue() nativo, seta QUEUE_PRIO a partir de RoutingRule
// - /queue-outcome,<queueId> - depois do Queue(), lê QUEUESTATUS pra finalizar queue_calls
//   (timeout/sem agente/fila cheia - únicos casos sem evento AMI terminal, ver ami-events.ts)
// - /queue-survey,<queueId> - depois do Queue(), captura MEMBERINTERFACE pra pesquisa de satisfação
// - /survey-result,<queueId>,<category>,<score> - fim de cada pergunta da pesquisa
//   (callcenter-surveys), persiste a nota (category: "atendimento" ou "servico")
// - /transfer-route (sem arg) - contexto estático [transfer], resolve EXTEN discado (ramal ou fila)
//   pro accountcode do canal, chamado via TRANSFER_CONTEXT em toda transferência DTMF atendida (*2)
// - /ramal-fallback (sem arg) - pattern genérico de ramal ([ramais], ver dialplan.repository.ts),
//   chamado só quando o Dial direto pro ramal falha com CHANUNAVAIL - tenta fila, depois rota de saída
// - /resolve-did-route (sem arg) - "i" de [from-trunk-routed] (ver base-dialplan.repository.ts),
//   chamado só quando a chave rápida <did>_<accountcode do tronco de entrada> não bateu - lookup
//   global por DID_ENTRY pra achar a empresa dona real (tronco de entrada != tronco da empresa)
// Protocolo AGI é estritamente request/response - nunca disparar dois comandos concorrentes no mesmo
// socket, a ordem das respostas quebra.

type AgiConn = {
    socket: Bun.Socket<AgiConn>
    buffer: string
    lineQueue: string[]
    lineResolvers: Array<(line: string) => void>
}

// Quando o Asterisk envia o ambiente AGI inteiro em um único pacote TCP, todas as linhas chegam
// de uma vez antes dos awaits seguintes registrarem resolvers - lineQueue armazena as linhas
// chegadas sem resolver pendente para entrega síncrona no próximo readLine.
function feedData(conn: AgiConn, chunk: string) {
    conn.buffer += chunk
    let idx: number
    while ((idx = conn.buffer.indexOf('\n')) !== -1) {
        const line = conn.buffer.slice(0, idx).replace(/\r$/, '')
        conn.buffer = conn.buffer.slice(idx + 1)
        const resolve = conn.lineResolvers.shift()
        if (resolve) resolve(line)
        else conn.lineQueue.push(line)
    }
}

function readLine(conn: AgiConn): Promise<string> {
    if (conn.lineQueue.length > 0) return Promise.resolve(conn.lineQueue.shift()!)
    return new Promise((resolve) => conn.lineResolvers.push(resolve))
}

async function readAgiEnv(conn: AgiConn): Promise<Record<string, string>> {
    const env: Record<string, string> = {}
    while (true) {
        const line = await readLine(conn)
        if (line === '') break
        const idx = line.indexOf(':')
        if (idx === -1) continue
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return env
}

// AGI exige valor entre aspas quando contém espaço - sempre quotar é seguro mesmo sem espaço
function agiQuote(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`
}

async function sendAgiCommand(conn: AgiConn, command: string): Promise<{ code: number; result: string; extra?: string }> {
    conn.socket.write(`${command}\n`)
    const line = await readLine(conn)
    const match = line.match(/^(\d{3})\s+result=(-?\S*)(?:\s+\((.*)\))?/)
    if (!match) return { code: 0, result: '' }
    return { code: Number(match[1]), result: match[2] ?? '', extra: match[3] }
}

async function agiGetVariable(conn: AgiConn, name: string): Promise<string | null> {
    const { result, extra } = await sendAgiCommand(conn, `GET VARIABLE ${name}`)
    return result === '1' ? (extra ?? '') : null
}

async function agiSetVariable(conn: AgiConn, name: string, value: string) {
    await sendAgiCommand(conn, `SET VARIABLE ${name} ${agiQuote(value)}`)
}

// VERBOSE escreve direto no console do Asterisk, na mesma timeline das linhas "AGI Tx/Rx" -
// visão em tempo real do que o handler está fazendo (qual processo, o que foi lido, o resultado)
// sem precisar cruzar com o log da aplicação (pino) numa aba separada. Level 1 = sempre visível
// em qualquer verbosidade de console ligada.
async function agiVerbose(conn: AgiConn, message: string, level = 1) {
    await sendAgiCommand(conn, `VERBOSE ${agiQuote(message)} ${level}`)
}

// VERBOSE tem limite prático de linha no console do Asterisk - corta payload/resposta grandes
// (o app log via logger continua com o body inteiro, ver responseSample truncado em 1000 já usado ali)
function truncateForVerbose(value: string, max = 300): string {
    return value.length > max ? `${value.slice(0, max)}…(truncado)` : value
}

// SET CONTEXT/EXTENSION/PRIORITY são os comandos nativos do protocolo AGI pra redirecionar o
// dialplan pra onde o script quer continuar QUANDO ele terminar - diferente de "EXEC Goto ctx,ext,pri"
// (rodar a aplicação Goto por dentro do próprio AGI), que tem histórico de comportamento
// inconsistente entre versões/timing e foi a causa raiz de um Goto que simplesmente não surtia
// efeito em produção (ver comentário no topo de variablecondition.repository.ts).
async function agiExecGoto(conn: AgiConn, target: { context: string; exten: string; priority: number }) {
    await sendAgiCommand(conn, `SET CONTEXT ${target.context}`)
    await sendAgiCommand(conn, `SET EXTENSION ${target.exten}`)
    await sendAgiCommand(conn, `SET PRIORITY ${target.priority}`)
}

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g

// {{CALLERID(num)}}, {{EXTEN}}, {{qualquer_var_de_canal}} - resolvido via AGI GET VARIABLE, que já
// avalia funções de dialplan quando a expressão tem a forma FUNC(args)
async function resolvePlaceholders(conn: AgiConn, input: string): Promise<string> {
    const matches = [...input.matchAll(PLACEHOLDER_RE)]
    if (matches.length === 0) return input
    let result = input
    for (const m of matches) {
        const value = await agiGetVariable(conn, m[1]!.trim())
        result = result.replace(m[0], value ?? '')
    }
    return result
}

// Sequencial de propósito (nunca Promise.all) - comandos AGI não podem ser concorrentes no mesmo socket
async function resolvePlaceholdersDeep(conn: AgiConn, value: unknown): Promise<unknown> {
    if (typeof value === 'string') return resolvePlaceholders(conn, value)
    if (Array.isArray(value)) {
        const out: unknown[] = []
        for (const item of value) out.push(await resolvePlaceholdersDeep(conn, item))
        return out
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) out[k] = await resolvePlaceholdersDeep(conn, v)
        return out
    }
    return value
}

// avalia "data.client[0].id" sobre o JSON de resposta já parseado
function evalResponsePath(obj: unknown, path: string): unknown {
    const tokens = path.match(/[^.[\]]+/g) ?? []
    let current: any = obj
    for (const token of tokens) {
        if (current == null) return undefined
        current = current[token]
    }
    return current
}

async function handleRequestTemplate(conn: AgiConn, templateId: string) {
    let template = (await RequestTemplatesCache.getAgiTemplate(templateId)) as Awaited<ReturnType<typeof prisma.requestTemplate.findUnique>> | null
    if (!template) {
        template = await prisma.requestTemplate.findUnique({ where: { id: templateId } })
        if (template) await RequestTemplatesCache.setAgiTemplate(templateId, template)
    }
    if (!template) {
        logger.warn({ event: 'agi.request_template.not_found', templateId })
        return
    }

    const url = await resolvePlaceholders(conn, template.url)
    const headersRaw = (template.headers as Record<string, string> | null) ?? {}
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(headersRaw)) headers[k] = await resolvePlaceholders(conn, v)

    const bodyRaw = template.body as Record<string, unknown> | null
    const body = bodyRaw ? await resolvePlaceholdersDeep(conn, bodyRaw) : undefined

    await agiVerbose(conn, `Request Template "${template.name}": ${template.method} ${url}`)

    let success = false
    let status: number | undefined
    let rawBody = ''
    let parsed: unknown = null

    try {
        // SSRF: fixa o IP validado no socket e não segue redirects para hosts internos.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), template.timeoutMs)
        try {
            const res = await safeFetch(url, {
                method: template.method,
                headers,
                body: body !== undefined && template.method !== 'GET' ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })
            success = res.ok
            status = res.status
            // Captura o texto primeiro pra logar o body cru mesmo quando o JSON.parse falha
            rawBody = await res.text()
            try { parsed = JSON.parse(rawBody) } catch { parsed = null }
        } finally {
            clearTimeout(timeout)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn({ event: 'agi.request_template.failed', templateId, message })
        await agiVerbose(conn, `Request Template "${template.name}": erro na chamada - ${message}`, 2)
        success = false
    }

    const mappings = (template.variableMappings as VariableMapping[] | null) ?? []
    const unresolved: Array<{ variable: string; path: string }> = []
    for (const mapping of mappings) {
        const value = evalResponsePath(parsed, mapping.path)
        if (value !== undefined) {
            await agiSetVariable(conn, mapping.variable, typeof value === 'string' ? value : JSON.stringify(value))
        } else {
            unresolved.push({ variable: mapping.variable, path: mapping.path })
        }
    }

    // unresolved.length > 0 sobe pra warn (visível em produção) com o body truncado - sem isso
    // não dá pra saber se o path da mapping está errado ou se a API devolveu um shape diferente
    if (unresolved.length > 0) {
        logger.warn({
            event: 'agi.request_template.unresolved_mapping',
            templateId,
            url,
            status,
            jsonParsed: parsed !== null,
            responseSample: rawBody.slice(0, 1000),
            unresolved,
        })
    }

    logger.info({ event: 'agi.request_template.done', templateId, success, mappings: mappings.length })
    await agiVerbose(conn, `Request Template "${template.name}": ${success ? 'sucesso' : 'falhou'} (status=${status ?? 'erro de rede'}, ${mappings.length - unresolved.length}/${mappings.length} variáveis mapeadas)`)
    const nodeId = await agiGetVariable(conn, FLOW_NODE_ID_VAR)
    if (nodeId) {
        await agiExecGoto(conn, { context: FLOW_NODE_CONTEXT, exten: flowNodeExitExten(nodeId, success ? 'success' : 'error'), priority: 1 })
        return
    }
    const dest = await FlowEdgeRepository.getOne('requesttemplate', templateId, success ? 'success' : 'error')
    const target = await resolveRouteDestinationToDialplan(dest)
    if (target) await agiExecGoto(conn, target)
}

// Mesma estrutura de handleRequestTemplate (AGI síncrono, onSuccess/onError por FlowEdge), mas sem
// url/headers manuais: credencial (base URL + token, descriptografado só neste momento) + params
// resolvidos por placeholder viram uma chamada fixa do catálogo IXC_ACTIONS (ver integrations/ixc/client.ts).
async function handleIxcNode(conn: AgiConn, nodeId: string) {
    let node = (await IxcNodesCache.getAgiNode(nodeId)) as Awaited<ReturnType<typeof prisma.ixcNode.findUnique>> | null
    if (!node) {
        node = await prisma.ixcNode.findUnique({ where: { id: nodeId } })
        if (node) await IxcNodesCache.setAgiNode(nodeId, node)
    }
    if (!node) {
        logger.warn({ event: 'agi.ixc_node.not_found', nodeId })
        return
    }
    const credential = await getIntegrationCredentialForCall(node.credentialId)
    if (!credential) {
        logger.warn({ event: 'agi.ixc_node.credential_not_found', nodeId, credentialId: node.credentialId })
        return
    }

    const paramsRaw = (node.params as Record<string, string> | null) ?? {}
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(paramsRaw)) params[k] = await resolvePlaceholders(conn, v)

    await agiVerbose(conn, `IXC Node "${node.name}": ação=${node.action} params=${JSON.stringify(params)}`)

    let success = false
    let parsed: unknown = null

    try {
        const token = decryptForCompany(node.companyId, {
            ciphertext: credential.tokenCiphertext,
            iv: credential.tokenIv,
            tag: credential.tokenTag,
        })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), node.timeoutMs)
        try {
            const result = await runIxcAction({ baseUrl: credential.baseUrl, token }, node.action as IxcAction, params, controller.signal)
            parsed = result.data
            success = result.ok
            await agiVerbose(conn, `IXC Node "${node.name}": POST ${result.url} payload=${truncateForVerbose(JSON.stringify(result.payload))}`)
            await agiVerbose(conn, `IXC Node "${node.name}": status=${result.status} resposta=${truncateForVerbose(result.rawBody)}`, success ? 1 : 2)
            if (!success) {
                logger.warn({
                    event: 'agi.ixc_node.http_error',
                    nodeId,
                    action: node.action,
                    url: result.url,
                    status: result.status,
                    responseSample: result.rawBody.slice(0, 1000),
                })
            }
        } finally {
            clearTimeout(timeout)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn({ event: 'agi.ixc_node.failed', nodeId, message })
        await agiVerbose(conn, `IXC Node "${node.name}": erro na chamada - ${message}`, 2)
        success = false
    }

    const mappings = (node.variableMappings as VariableMapping[] | null) ?? []
    const unresolved: Array<{ variable: string; path: string }> = []
    for (const mapping of mappings) {
        const value = evalResponsePath(parsed, mapping.path)
        if (value !== undefined) {
            await agiSetVariable(conn, mapping.variable, typeof value === 'string' ? value : JSON.stringify(value))
        } else {
            unresolved.push({ variable: mapping.variable, path: mapping.path })
        }
    }
    if (unresolved.length > 0) {
        logger.warn({ event: 'agi.ixc_node.unresolved_mapping', nodeId, action: node.action, unresolved })
        await agiVerbose(conn, `IXC Node "${node.name}": mapping não resolvido: ${unresolved.map((u) => `${u.variable}<=${u.path}`).join(', ')}`, 2)
    }

    logger.info({ event: 'agi.ixc_node.done', nodeId, action: node.action, success, mappings: mappings.length })
    await agiVerbose(conn, `IXC Node "${node.name}": ${success ? 'sucesso' : 'falhou'} (${mappings.length - unresolved.length}/${mappings.length} variáveis mapeadas)`)
    const flowNodeId = await agiGetVariable(conn, FLOW_NODE_ID_VAR)
    if (flowNodeId) {
        await agiExecGoto(conn, { context: FLOW_NODE_CONTEXT, exten: flowNodeExitExten(flowNodeId, success ? 'success' : 'error'), priority: 1 })
        return
    }
    const dest = await FlowEdgeRepository.getOne('ixcnode', nodeId, success ? 'success' : 'error')
    const target = await resolveRouteDestinationToDialplan(dest)
    if (target) await agiExecGoto(conn, target)
}

// Lê o valor REAL de cada rule.variable via AGI GET VARIABLE (resolve função de canal tipo
// CALLERID(num) nativamente, sem precisar montar nenhuma expressão) e avalia em JS puro - ver
// motivo da migração (era $[...] interpolado, quebrava com valor de tamanho errado ou com aspas)
// no comentário de topo de variablecondition.repository.ts. Sequencial de propósito: comandos AGI
// não podem ser concorrentes no mesmo socket.
async function handleVariableCondition(conn: AgiConn, conditionId: string) {
    let condition = (await VariableConditionsCache.getAgiVariableCondition(conditionId)) as Awaited<ReturnType<typeof prisma.variableCondition.findUnique>> | null
    if (!condition) {
        condition = await prisma.variableCondition.findUnique({ where: { id: conditionId } })
        if (condition) await VariableConditionsCache.setAgiVariableCondition(conditionId, condition)
    }
    if (!condition) {
        logger.warn({ event: 'agi.variable_condition.not_found', conditionId })
        return
    }

    const rules = condition.rules as VariableRule[]
    await agiVerbose(conn, `Variable Condition "${condition.name}": avaliando ${rules.length} regra(s), combinator=${condition.combinator}`)

    const results: boolean[] = []
    for (const rule of rules) {
        const value = (await agiGetVariable(conn, rule.variable)) ?? ''
        const result = evaluateRule(value, rule)
        results.push(result)
        // um log por regra - é o que dá pra saber, olhando só o log, o que foi lido do canal (não
        // só o que tá configurado) e por que bateu/não bateu, sem precisar reproduzir a ligação
        logger.info({
            event: 'agi.variable_condition.rule',
            conditionId,
            name: condition.name,
            variable: rule.variable,
            value,
            operator: rule.operator,
            ruleValue: rule.value ?? null,
            result,
        })
        await agiVerbose(conn, `  regra: ${rule.variable}="${value}" ${rule.operator}${rule.value !== undefined ? ` "${rule.value}"` : ''} => ${result ? 'true' : 'false'}`)
    }
    const matched = evaluateRules(condition.combinator as Combinator, results)
    logger.info({
        event: 'agi.variable_condition.done',
        conditionId,
        name: condition.name,
        combinator: condition.combinator,
        results,
        matched,
    })
    await agiVerbose(conn, `Variable Condition "${condition.name}": resultado final => ${matched ? 'TRUE' : 'FALSE'}`)

    const nodeId = await agiGetVariable(conn, FLOW_NODE_ID_VAR)
    if (nodeId) {
        const exten = flowNodeExitExten(nodeId, matched ? 'true' : 'false')
        logger.info({ event: 'agi.variable_condition.goto', conditionId, via: 'flow_node', nodeId, exten })
        await agiVerbose(conn, `Variable Condition "${condition.name}": indo para porta "${matched ? 'true' : 'false'}" do flow node`)
        await agiExecGoto(conn, { context: FLOW_NODE_CONTEXT, exten, priority: 1 })
        return
    }
    const dest = await FlowEdgeRepository.getOne('variablecondition', conditionId, matched ? 'true' : 'false')
    const target = await resolveRouteDestinationToDialplan(dest)
    if (!target) {
        // configurado (ou o create/update esqueceu de ligar essa porta) mas sem rota resolvível -
        // sem esse log, isso parece exatamente um "AGI não fez nada" visto de fora (mesmo formato do
        // bug de deploy que a gente acabou de caçar sem log nenhum pra guiar)
        logger.warn({ event: 'agi.variable_condition.no_route', conditionId, dest, matched })
        await agiVerbose(conn, `Variable Condition "${condition.name}": porta "${matched ? 'true' : 'false'}" sem destino configurado`, 2)
        return
    }
    logger.info({ event: 'agi.variable_condition.goto', conditionId, via: 'route_destination', target })
    await agiExecGoto(conn, target)
}

// Compara a data de hoje (no timezone da EMPRESA, não do processo/servidor Asterisk - mesmo padrão
// de resolveActiveRule/RoutingRules) contra as datas do grupo via matchesHolidayDate. Roda em JS
// porque GotoIfTime nativo do Asterisk nunca teve campo de ano (é tipo cron: times/weekdays/mdays/
// months) - sem isso não dá pra expressar feriado móvel vindo da API (Carnaval, Sexta-feira Santa),
// que muda de data ano a ano; ver year em HolidayDate/matchesHolidayDate.
const holidayGroupAgiSelect = {
    name: true,
    dates: { select: { month: true, day: true, year: true } },
    company: { select: { timezone: true } },
} as const
const _holidayGroupAgiRow = () => prisma.holidayGroup.findUnique({ where: { id: '' }, select: holidayGroupAgiSelect })

async function handleHolidayCheck(conn: AgiConn, groupId: string) {
    let group = (await HolidayGroupsCache.getAgiHolidayGroup(groupId)) as Awaited<ReturnType<typeof _holidayGroupAgiRow>> | null
    if (!group) {
        group = await prisma.holidayGroup.findUnique({ where: { id: groupId }, select: holidayGroupAgiSelect })
        if (group) await HolidayGroupsCache.setAgiHolidayGroup(groupId, group)
    }
    if (!group) {
        logger.warn({ event: 'agi.holiday_group.not_found', groupId })
        return
    }

    const today = dateInTimeZone(new Date(), group.company.timezone)
    const matched = matchesHolidayDate(group.dates, today)
    // Data configurada de cada feriado, não só a contagem - é o que permite ver, olhando o console
    // do Asterisk numa ligação real, se o grupo tem a data certa cadastrada sem precisar abrir a tela
    const datesLabel = group.dates
        .map((d) => `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}${d.year ? `/${d.year}` : ''}`)
        .join(', ')

    logger.info({
        event: 'agi.holiday_group.done',
        groupId,
        name: group.name,
        timezone: group.company.timezone,
        today,
        dates: group.dates,
        matched,
    })
    await agiVerbose(conn, `Holiday Group "${group.name}": hoje=${today.year}-${today.month}-${today.day} (${group.company.timezone}) => ${matched ? 'TRUE (feriado)' : 'FALSE'}`)
    await agiVerbose(conn, `Holiday Group "${group.name}": datas configuradas (${group.dates.length}): ${group.dates.length > 0 ? truncateForVerbose(datesLabel) : '(nenhuma)'}`)

    const nodeId = await agiGetVariable(conn, FLOW_NODE_ID_VAR)
    if (nodeId) {
        const exten = flowNodeExitExten(nodeId, matched ? 'true' : 'false')
        logger.info({ event: 'agi.holiday_group.goto', groupId, via: 'flow_node', nodeId, exten })
        await agiExecGoto(conn, { context: FLOW_NODE_CONTEXT, exten, priority: 1 })
        return
    }
    const dest = await FlowEdgeRepository.getOne('holidaygroup', groupId, matched ? 'true' : 'false')
    const target = await resolveRouteDestinationToDialplan(dest)
    if (!target) {
        // configurado (ou o create/update esqueceu de ligar essa porta) mas sem rota resolvível - mesmo
        // log de handleVariableCondition, pra não parecer "AGI não fez nada" visto de fora
        logger.warn({ event: 'agi.holiday_group.no_route', groupId, dest, matched })
        await agiVerbose(conn, `Holiday Group "${group.name}": porta "${matched ? 'true' : 'false'}" sem destino configurado`, 2)
        return
    }
    logger.info({ event: 'agi.holiday_group.goto', groupId, via: 'route_destination', target })
    await agiExecGoto(conn, target)
}

// Roda ANTES do GotoIfTime nativo (priority 1 de tc-<tcId>, ver timecondition.repository.ts) só
// pra deixar visível no console do Asterisk quais períodos estão configurados numa ligação real -
// a avaliação em si continua 100% nativa (GotoIfTime na priority seguinte), esse AGI não decide
// nada nem faz Goto, só loga e deixa o dialplan seguir sozinho pra próxima priority.
const timeConditionAgiSelect = {
    name: true,
    timeGroups: { select: { timeGroup: { select: { name: true, ranges: true } } } },
} as const
const _timeConditionAgiRow = () => prisma.timeCondition.findUnique({ where: { id: '' }, select: timeConditionAgiSelect })

async function handleTimeConditionCheck(conn: AgiConn, tcId: string) {
    let tc = (await TimeConditionsCache.getAgiTimeCondition(tcId)) as Awaited<ReturnType<typeof _timeConditionAgiRow>> | null
    if (!tc) {
        tc = await prisma.timeCondition.findUnique({ where: { id: tcId }, select: timeConditionAgiSelect })
        if (tc) await TimeConditionsCache.setAgiTimeCondition(tcId, tc)
    }
    if (!tc) {
        logger.warn({ event: 'agi.time_condition.not_found', tcId })
        return
    }

    const ranges = tc.timeGroups.flatMap((g) => g.timeGroup.ranges)
    const rangesLabel = ranges
        .map((r) => {
            const weekdays = r.weekdays.length > 0 ? r.weekdays.join(',') : '*'
            const extra = [
                r.monthdays !== '*' ? `dia ${r.monthdays}` : null,
                r.months !== '*' ? r.months : null,
            ].filter(Boolean)
            return `${r.startTime}-${r.endTime} (${weekdays}${extra.length > 0 ? `, ${extra.join(', ')}` : ''})`
        })
        .join(' | ')

    logger.info({
        event: 'agi.time_condition.check',
        tcId,
        name: tc.name,
        groups: tc.timeGroups.map((g) => g.timeGroup.name),
        ranges,
    })
    await agiVerbose(conn, `Time Condition "${tc.name}": grupo(s) ${tc.timeGroups.map((g) => g.timeGroup.name).join(', ') || '(nenhum)'}`)
    await agiVerbose(conn, `Time Condition "${tc.name}": períodos configurados (${ranges.length}): ${ranges.length > 0 ? truncateForVerbose(rangesLabel) : '(nenhum)'}`)
}

// Lê inputVariable via AGI GET VARIABLE, tenta cada máscara de `masks` em ordem (applyMask,
// src/utils/format-mask.ts) e grava o resultado em outputVariable - onSuccess/onError seguem o
// mesmo mecanismo de FlowEdge do IxcNode (FLOW_NODE_ID quando dentro de um Flow, senão
// FlowEdgeRepository direto quando usado como RouteDestination solto).
async function handleFormatterNode(conn: AgiConn, formatterNodeId: string) {
    let node = (await FormatterNodesCache.getAgiNode(formatterNodeId)) as Awaited<ReturnType<typeof prisma.formatterNode.findUnique>> | null
    if (!node) {
        node = await prisma.formatterNode.findUnique({ where: { id: formatterNodeId } })
        if (node) await FormatterNodesCache.setAgiNode(formatterNodeId, node)
    }
    if (!node) {
        logger.warn({ event: 'agi.formatter_node.not_found', formatterNodeId })
        return
    }

    const rawValue = (await agiGetVariable(conn, node.inputVariable)) ?? ''
    const masks = node.masks as string[]
    const result = applyMask(rawValue, masks)

    let matched = false
    if (result) {
        matched = true
        await agiSetVariable(conn, node.outputVariable, result.output)
        await agiVerbose(conn, `Formatter "${node.name}": ${node.inputVariable}="${rawValue}" => máscara "${result.matched}" => ${node.outputVariable}="${result.output}"`)
    } else {
        await agiVerbose(conn, `Formatter "${node.name}": ${node.inputVariable}="${rawValue}" não bateu com nenhuma das ${masks.length} máscara(s) configurada(s)`, 2)
    }

    logger.info({ event: 'agi.formatter_node.done', formatterNodeId, matched, inputVariable: node.inputVariable, outputVariable: node.outputVariable })

    const flowNodeId = await agiGetVariable(conn, FLOW_NODE_ID_VAR)
    if (flowNodeId) {
        await agiExecGoto(conn, { context: FLOW_NODE_CONTEXT, exten: flowNodeExitExten(flowNodeId, matched ? 'success' : 'error'), priority: 1 })
        return
    }
    const dest = await FlowEdgeRepository.getOne('formatternode', formatterNodeId, matched ? 'success' : 'error')
    const target = await resolveRouteDestinationToDialplan(dest)
    if (target) await agiExecGoto(conn, target)
}

// Seta QUEUE_PRIO (lido nativamente pelo Queue() nativo pra furar a fila) a partir da RoutingRule
// ativa de maior priority cujas conditions batem (trunk/callerId/weekday/horário) - ver
// RoutingRulesService.resolveActiveRule. Sem regra ativa/nenhuma bate, não seta nada (comportamento
// padrão do Queue() inalterado). ROUTING_TRUNK_ID vem setado desde o entry point de
// from-trunk-routed (inboundroute.repository.ts) e sobrevive a qualquer Goto intermediário.
async function handleQueueRoute(conn: AgiConn, queueId: string) {
    const queue = await prisma.queue.findUnique({ where: { id: queueId }, select: { companyId: true, company: { select: { timezone: true } } } })
    if (!queue) return

    const callerId = (await agiGetVariable(conn, 'CALLERID(num)')) ?? ''
    const trunkId = await agiGetVariable(conn, ROUTING_TRUNK_VAR)
    const rule = await resolveActiveRule(queue.companyId, { callerId, at: new Date(), timezone: queue.company.timezone, trunkId })
    if (rule) {
        await agiSetVariable(conn, 'QUEUE_PRIO', String(rule.priority))
        await agiVerbose(conn, `Queue Route: regra "${rule.name}" bateu (callerId=${callerId}, trunkId=${trunkId ?? '-'}) => QUEUE_PRIO=${rule.priority}`)
    } else {
        await agiVerbose(conn, `Queue Route: nenhuma RoutingRule ativa bateu (callerId=${callerId}, trunkId=${trunkId ?? '-'})`)
    }
}

// Roda logo após o Queue() retornar (antes da pesquisa) - QUEUESTATUS só vem preenchido quando
// o canal do ligante sobrevive e o Queue() segue pra próxima priority (timeout/sem agente/fila
// cheia); vazio quando a chamada foi de fato atendida (nesse caso AgentComplete via AMI já
// finalizou queue_calls, ver finalizeByQueueStatus que ignora QUEUESTATUS vazio).
async function handleQueueOutcome(conn: AgiConn, queueId: string) {
    const queueStatus = (await agiGetVariable(conn, 'QUEUESTATUS')) ?? ''
    const callerUniqueid = await agiGetVariable(conn, 'UNIQUEID')
    await agiVerbose(conn, `Queue Outcome: QUEUESTATUS=${queueStatus || '(vazio, atendida por AMI)'}`)
    if (!callerUniqueid) return
    await finalizeByQueueStatus({ queueId, callerUniqueid, queueStatus })
}

// Roda depois do Queue() (só é alcançado quando o AGENTE desliga primeiro - ver comentário em
// resolvePostQueueDestination de queue.repository.ts; se o cliente desligar primeiro, esse AGI nunca
// roda, limitação física de qualquer pesquisa por IVR pós-chamada). MEMBERINTERFACE só vem populado
// se houve bridge real com um agente (vazio em timeout/sem agente) - nesse caso segue sem fazer nada.
async function handleQueueSurvey(conn: AgiConn, queueId: string) {
    const memberInterface = await agiGetVariable(conn, 'MEMBERINTERFACE')
    if (!memberInterface) {
        await agiVerbose(conn, 'Queue Survey: MEMBERINTERFACE vazio (sem bridge com agente), sem pesquisa')
        return
    }

    const parsed = parseMemberInterface(memberInterface)
    if (!parsed) {
        await agiVerbose(conn, `Queue Survey: MEMBERINTERFACE "${memberInterface}" não reconhecido, sem pesquisa`, 2)
        return
    }

    const [extension, queue] = await Promise.all([
        prisma.extension.findUnique({ where: { number: parsed.number }, select: { id: true } }),
        prisma.queue.findUnique({ where: { id: queueId }, select: { companyId: true, surveyAudioId: true, surveyServiceAudioId: true } }),
    ])
    if (!extension || !queue?.surveyAudioId || !queue?.surveyServiceAudioId) {
        await agiVerbose(conn, `Queue Survey: fila sem os 2 áudios de pesquisa configurados (ramal ${parsed.number}), sem pesquisa`)
        return
    }

    await agiSetVariable(conn, 'CC_EXTENSION_ID', extension.id)
    await agiSetVariable(conn, 'CC_COMPANY_ID', queue.companyId)
    await agiVerbose(conn, `Queue Survey: agente ramal ${parsed.number} atendeu, iniciando pesquisa de satisfação`)
    await agiExecGoto(conn, { context: SURVEY_CONTEXT, exten: surveyExten(queueId), priority: 1 })
}

const SURVEY_CATEGORIES = ['atendimento', 'servico'] as const
type SurveyCategory = (typeof SURVEY_CATEGORIES)[number]

// Chamado pelo dialplan gerado em callcenter-survey.repository.ts quando o cliente digita a nota
// (1-5) de qualquer uma das 2 perguntas - lê de volta o contexto setado por handleQueueSurvey no
// mesmo canal (Set/Goto preservam variáveis de canal, não precisa de variável herdada com prefixo
// __) e persiste via RatingsService, chamado direto em processo, sem HTTP. `category` diferencia a
// pergunta de atendimento (o agente, entra em AgentAffinity) da de serviço contratado (só
// informativo - ver affinity.service.ts).
async function handleSurveyResult(conn: AgiConn, queueId: string, categoryRaw: string, scoreRaw: string) {
    const score = Number(scoreRaw)
    if (!Number.isInteger(score) || score < 1 || score > 5) return
    if (!SURVEY_CATEGORIES.includes(categoryRaw as SurveyCategory)) {
        logger.warn({ event: 'agi.callcenter.survey_result.invalid_category', queueId, category: categoryRaw })
        return
    }
    const category = categoryRaw as SurveyCategory

    // sequencial de propósito (nunca Promise.all) - comandos AGI não podem ser concorrentes no
    // mesmo socket (ver comentário na linha 144); Promise.all aqui travava o AGI pra sempre porque
    // só o 1º GET VARIABLE chegava a ser enviado, o resto ficava esperando resposta que nunca vinha
    const extensionId = await agiGetVariable(conn, 'CC_EXTENSION_ID')
    const companyId = await agiGetVariable(conn, 'CC_COMPANY_ID')
    const number = await agiGetVariable(conn, 'CALLERID(num)')
    // liga a nota ao CDR dessa mesma chamada (cdr.uniqueid) - permite baixar a gravação vinculada
    // na tela de notas de atendimento; sem FK de propósito, cdr.uniqueid é solto (ver schema.prisma)
    const uniqueid = await agiGetVariable(conn, 'UNIQUEID')
    if (!extensionId || !companyId || !number) {
        logger.warn({ event: 'agi.callcenter.survey_result.missing_context', queueId })
        await agiVerbose(conn, 'Survey Result: contexto da pesquisa perdido (canal sem CC_EXTENSION_ID/CC_COMPANY_ID)', 2)
        return
    }

    try {
        await createRating({ companyId, extensionId, number, score, category, uniqueid: uniqueid ?? undefined })
        await agiVerbose(conn, `Survey Result: nota ${score} (${category}) registrada (ramal ${extensionId}, número ${number})`)
    } catch (error) {
        logger.warn({
            event: 'agi.callcenter.survey_result.failed',
            queueId,
            message: error instanceof Error ? error.message : String(error),
        })
        await agiVerbose(conn, `Survey Result: falha ao salvar nota - ${error instanceof Error ? error.message : String(error)}`, 2)
    }
}

// Lê o mesmo cache de presença do módulo realtime (rt:ext:<number>, ver ami-events.ts) - falha aberta
// (retorna 'unknown') se o Redis estiver fora do ar ou a chave ainda não existir, pra nunca bloquear
// uma transferência válida por causa de infraestrutura de monitoramento indisponível.
async function getExtensionPresence(number: string): Promise<'online' | 'offline' | 'unknown'> {
    try {
        const presence = await redisClient.hGet(extKey(number), 'presence')
        return presence === 'online' || presence === 'offline' ? presence : 'unknown'
    } catch (error) {
        logger.warn({
            event: 'agi.transfer_route.presence_read_failed',
            number,
            message: error instanceof Error ? error.message : String(error),
        })
        return 'unknown'
    }
}

// Passos 2 e 3 da busca (fila, depois rota de saída) - compartilhado entre handleTransferRoute (chamado
// já sabendo que EXTEN não é ramal, ver prisma.extension.findUnique ali) e handleRamalFallback (chamado
// só quando o Dial contra PJSIP/<EXTEN>_<accountcode> falhou com CHANUNAVAIL, ou seja "não existe esse
// ramal" já resolvido pelo próprio Asterisk). Retorna true quando fez EXEC GOTO (chamador não deve
// prosseguir nem logar "não encontrado").
async function resolveQueueOrOutboundFallback(
    conn: AgiConn,
    exten: string,
    company: { id: string },
    accountcode: string,
    logPrefix: string,
): Promise<boolean> {
    const queue = await prisma.queue.findUnique({
        where: { number_companyId: { number: exten, companyId: company.id } },
        select: { number: true },
    })
    if (queue) {
        await agiVerbose(conn, `${logPrefix}: encaminhando para fila ${queue.number}`)
        await agiExecGoto(conn, { context: QUEUE_APP_CONTEXT, exten: queueAppExten(accountcode, queue.number), priority: 1 })
        return true
    }

    // Nem ramal nem fila da empresa - tenta como rota de saída. Os patterns de outbound route já são
    // escritos no próprio contexto 'ramais' (ver outbound-routes.service.ts:syncPatternDialplan), então o
    // Goto abaixo reaproveita o dialplan de outbound já montado (troncos, CDR, gravação) em vez de duplicar
    // essa lógica aqui - só precisamos confirmar ANTES que existe algum candidato: sem essa checagem, um
    // EXTEN que não é ramal/fila/rota nenhuma cairia de novo no pattern genérico de ramal (_XX.._XXXXXX,
    // sempre presente pra qualquer tamanho 2-6) e entraria num loop de Goto contra si mesmo.
    const outboundPatterns = await prisma.outboundDialPattern.findMany({
        where: { route: { companyId: company.id } },
        select: { pattern: true },
    })
    if (outboundPatterns.some((p) => extenPatternMatches(p.pattern, exten))) {
        await agiVerbose(conn, `${logPrefix}: "${exten}" não é ramal nem fila, tentando rota de saída`)
        await agiExecGoto(conn, { context: 'ramais', exten, priority: 1 })
        return true
    }

    return false
}

// Chamado pelo contexto estático [transfer] (extensions.conf) quando um agente/cliente dispara uma
// transferência DTMF atendida (*2, ver features.conf) - TRANSFER_CONTEXT=transfer é setado desde a entrada
// da chamada (ver inboundroute.repository.ts). EXTEN é o número discado pela parte que transferiu
// (alias de ramal OU number de fila); CHANNEL(accountcode) já identifica a empresa (setado nativamente
// pelo endpoint PJSIP de origem, sem precisar de Set()) - resolve pro mesmo Company.asteriskId usado
// em todo o resto do dialplan multi-tenant. Ramal tem prioridade sobre fila em caso de colisão de
// número (nunca deveria colidir de fato - aliases e queue numbers não têm unicidade cruzada hoje).
async function handleTransferRoute(conn: AgiConn) {
    const exten = (await agiGetVariable(conn, 'EXTEN')) ?? ''
    const accountcode = (await agiGetVariable(conn, 'CHANNEL(accountcode)')) ?? ''
    if (!exten || !accountcode) return

    const company = await prisma.company.findUnique({ where: { asteriskId: accountcode }, select: { id: true } })
    if (!company) {
        logger.warn({ event: 'agi.transfer_route.unknown_accountcode', accountcode })
        await agiVerbose(conn, `Transfer Route: accountcode "${accountcode}" não corresponde a nenhuma empresa`, 2)
        return
    }

    const extension = await prisma.extension.findUnique({
        where: { alias_companyId: { alias: exten, companyId: company.id } },
        select: { context: true, alias: true, number: true },
    })
    if (extension) {
        const presence = await getExtensionPresence(extension.number)
        if (presence === 'offline') {
            logger.info({ event: 'agi.transfer_route.target_offline', exten, companyId: company.id })
            await agiVerbose(conn, `Transfer Route: ramal ${extension.alias} está offline, abortando transferência`)
            return
        }
        await agiVerbose(conn, `Transfer Route: encaminhando para ramal ${extension.alias}`)
        await agiExecGoto(conn, { context: extension.context, exten: extension.alias, priority: 1 })
        return
    }

    if (await resolveQueueOrOutboundFallback(conn, exten, company, accountcode, 'Transfer Route')) return

    logger.info({ event: 'agi.transfer_route.not_found', exten, companyId: company.id })
    await agiVerbose(conn, `Transfer Route: "${exten}" não é ramal, fila nem rota de saída da empresa`, 2)
}

// Chamado pelo "i" de [from-trunk-routed] (ver base-dialplan.repository.ts) SÓ quando a chave
// rápida <did>_<accountcode do tronco de entrada> não bateu - ou seja, o DID discado existe mas a
// chamada chegou por um tronco de empresa diferente da dona dele (operadora entregando por tronco
// compartilhado/errado). DID_ENTRY guarda o número original (${EXTEN} já virou "i" nesse ponto).
// DID.number é único globalmente (schema.prisma) - achar exatamente 1 match ativo com InboundRoute
// configurada já garante a empresa dona certa, sem precisar saber por qual tronco a chamada entrou.
async function handleResolveDidRoute(conn: AgiConn) {
    const did = (await agiGetVariable(conn, 'DID_ENTRY')) ?? ''
    if (!did) return

    const matches = await prisma.did.findMany({
        where: { number: did, status: 'active', inboundRoutes: { some: {} } },
        select: { company: { select: { asteriskId: true } } },
    })

    if (matches.length === 0) {
        logger.info({ event: 'agi.resolve_did_route.not_found', did })
        return
    }
    // Nunca deveria acontecer (DID.number é único globalmente) - mas se um restore/tamper manual
    // deixar 2 empresas com o mesmo número ativo, não adivinha: vazar a chamada pra empresa errada
    // é pior que simplesmente não completar a ligação.
    if (matches.length > 1) {
        logger.error({
            event: 'agi.resolve_did_route.ambiguous',
            did,
            companies: matches.map((m) => m.company.asteriskId),
        })
        await agiVerbose(conn, `Resolve DID Route: "${did}" ambíguo entre ${matches.length} empresas, abortando`, 3)
        return
    }

    const companyAsteriskId = matches[0]!.company.asteriskId
    // CHANNEL(accountcode) já veio herdado do endpoint do tronco FÍSICO de entrada (empresa errada,
    // é justamente por isso que caímos aqui) - Asterisk seta isso antes de qualquer dialplan rodar,
    // então não dá pra sobrescrever via AGI função (arriscado, ver comentário em agiExecGoto) sem
    // antes validar contra um Asterisk real. Em vez disso, grava uma variável de canal SIMPLES
    // (mecanismo já usado à exaustão neste arquivo, ver QUEUE_PRIO/mapping.variable) - o próprio
    // dialplan (buildInboundEntries, ver inboundroute.repository.ts) sobrescreve CHANNEL(accountcode)
    // de verdade via Set() nativo (sintaxe Asterisk padrão, não side-effect de AGI) quando essa
    // variável vier preenchida. Sem isso, CDR/gravação (MIXMONITOR_FILENAME) continuariam presos
    // à empresa do tronco físico mesmo com o Goto certo - reportado pelo usuário como CDR vazando
    // pra empresa errada.
    await agiSetVariable(conn, 'RESOLVED_ACCOUNTCODE', companyAsteriskId)
    await agiVerbose(conn, `Resolve DID Route: "${did}" pertence à empresa ${companyAsteriskId}, redirecionando`)
    await agiExecGoto(conn, { context: TRUNK_ROUTED_CONTEXT, exten: routedExten(companyAsteriskId, did), priority: 1 })
}

// Chamado pelo pattern genérico de ramal ([ramais], ver ensureGenericRoutingPattern em
// dialplan.repository.ts) SÓ quando o Dial(PJSIP/<EXTEN>_<accountcode>) falhou com CHANUNAVAIL - ou
// seja, o próprio Asterisk já confirmou que não existe esse ramal (passo 1, "busca ramal", já feito
// nativamente pelo Dial em vez de uma query, já que endpoint PJSIP É a fonte de verdade de ramal
// existente). Daqui em diante são exatamente os passos 2 (fila) e 3 (rota de saída) do
// handleTransferRoute, compartilhados via resolveQueueOrOutboundFallback - permite discar direto uma
// fila (ex: ramal do suporte ligando pra fila do financeiro) sem precisar de transferência DTMF (*2).
async function handleRamalFallback(conn: AgiConn) {
    const exten = (await agiGetVariable(conn, 'EXTEN')) ?? ''
    const accountcode = (await agiGetVariable(conn, 'CHANNEL(accountcode)')) ?? ''
    if (!exten || !accountcode) return

    const company = await prisma.company.findUnique({ where: { asteriskId: accountcode }, select: { id: true } })
    if (!company) {
        logger.warn({ event: 'agi.ramal_fallback.unknown_accountcode', accountcode })
        await agiVerbose(conn, `Ramal Fallback: accountcode "${accountcode}" não corresponde a nenhuma empresa`, 2)
        return
    }

    if (await resolveQueueOrOutboundFallback(conn, exten, company, accountcode, 'Ramal Fallback')) return

    logger.info({ event: 'agi.ramal_fallback.not_found', exten, companyId: company.id })
    await agiVerbose(conn, `Ramal Fallback: "${exten}" não é fila nem rota de saída da empresa`, 2)
}

export function startAgiServer(host: string, port: number) {
    Bun.listen<AgiConn>({
        hostname: host,
        port,
        socket: {
            open(socket) {
                socket.data = { socket, buffer: '', lineQueue: [], lineResolvers: [] }
                handleConnection(socket.data).catch((error) => {
                    logger.error({ event: 'agi.session.error', message: error instanceof Error ? error.message : String(error) })
                }).finally(() => socket.end())
            },
            data(socket, chunk) {
                feedData(socket.data, chunk.toString('utf8'))
            },
            error(socket, error) {
                logger.error({ event: 'agi.socket.error', message: error.message })
            },
            close(socket) {
                for (const resolve of socket.data.lineResolvers) resolve('')
                socket.data.lineResolvers = []
            },
            drain() { },
        },
    })
    logger.info({ event: 'agi.server.started', host, port })
}

async function handleConnection(conn: AgiConn) {
    const env = await readAgiEnv(conn)
    const script = env['agi_network_script']
    const arg1 = env['agi_arg_1']
    logger.info({ event: 'agi.session.start', script, arg1, channel: env['agi_channel'] })
    await agiVerbose(conn, `AGI iniciado: script=${script ?? '(desconhecido)'} arg=${arg1 ?? '-'}`)

    try {
        // Único script sem argumento - resolve tudo via variáveis do canal (EXTEN/accountcode)
        if (script === 'transfer-route') { await handleTransferRoute(conn); return }
        if (script === 'ramal-fallback') { await handleRamalFallback(conn); return }
        if (script === 'resolve-did-route') { await handleResolveDidRoute(conn); return }
        if (!arg1) return

        if (script === 'queue-route') await handleQueueRoute(conn, arg1)
        else if (script === 'queue-outcome') await handleQueueOutcome(conn, arg1)
        else if (script === 'queue-survey') await handleQueueSurvey(conn, arg1)
        else if (script === 'survey-result') await handleSurveyResult(conn, arg1, env['agi_arg_2'] ?? '', env['agi_arg_3'] ?? '')
        else if (script === 'ixc') await handleIxcNode(conn, arg1)
        else if (script === 'varcond') await handleVariableCondition(conn, arg1)
        else if (script === 'holiday') await handleHolidayCheck(conn, arg1)
        else if (script === 'tc') await handleTimeConditionCheck(conn, arg1)
        else if (script === 'format') await handleFormatterNode(conn, arg1)
        else await handleRequestTemplate(conn, arg1)
    } catch (error) {
        // sem isso, uma exceção em qualquer handler vira um "AGI não fez nada" indistinguível de
        // script não reconhecido/registro não encontrado - só dava pra saber qual script/arg caiu
        // olhando o dialplan gerado e cruzando na mão (foi assim que achamos o bug de deploy antigo)
        const message = error instanceof Error ? error.message : String(error)
        logger.error({
            event: 'agi.session.error',
            script,
            arg1,
            message,
            stack: error instanceof Error ? error.stack : undefined,
        })
        // socket pode já estar comprometido (foi a exceção que caiu aqui) - nunca deixar essa
        // tentativa de aviso derrubar o handler de erro em si
        await agiVerbose(conn, `AGI ERRO: script=${script ?? '(desconhecido)'} arg=${arg1 ?? '-'} - ${message}`, 3).catch(() => {})
    }
}
