import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
    VAR_CONTEXT, varEntry, VARCOND_CONTEXT, varCondEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

export { VARCOND_CONTEXT, varCondEntry }

export type VariableRuleOperator =
    | 'filled' | 'empty'
    | 'length_eq' | 'length_neq' | 'length_gt' | 'length_gte' | 'length_lt' | 'length_lte'
    | 'eq' | 'neq' | 'contains' | 'regex'
    | 'gt' | 'gte' | 'lt' | 'lte'

export type VariableRule = { variable: string; operator: VariableRuleOperator; value?: string }
export type Combinator = 'and' | 'or'

const varFail = (entry: string) => `${entry}-fail`
const varMatched = (entry: string) => `${entry}-matched`

// escapa metacaracteres de regex POSIX ERE (usado pelo Asterisk REGEX()) — só usado internamente
// pra transformar um "contains" (substring literal) num pattern seguro, nunca em texto vindo direto
// do usuário sem passar por aqui (schema já proíbe aspas/backslash em `value`, ver variable-condition.schema.ts)
function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// mesmo contrato de resolveRoute() em timecondition.repository.ts — "context,exten,priority" ou null
async function resolveRoute(route: RouteDestination): Promise<string | null> {
    if (!route || route.type === 'hangup') return null

    switch (route.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: route.id }, select: { context: true, number: true } })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({
                where: { id: route.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${route.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(route.id)},1`
        case 'holiday':
            return `${HOL_CONTEXT},${holEntry(route.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(route.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(route.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(route.id)},1`
        case 'variable-set':
            return `${VAR_CONTEXT},${varEntry(route.id)},1`
        case 'variable-condition':
            return `${VARCOND_CONTEXT},${varCondEntry(route.id)},1`
    }
}

// Monta a expressão booleana Asterisk ($[...]) equivalente a uma regra — função pura, sem I/O,
// testável isoladamente. `value` já vem validado pelo schema (sem aspas/backslash), então dá pra
// interpolar direto nas strings entre aspas sem escaping em runtime.
export function buildExpr(rule: VariableRule): string {
    const v = `\${${rule.variable}}`
    switch (rule.operator) {
        case 'filled':     return `"${v}" != ""`
        case 'empty':      return `"${v}" = ""`
        case 'length_eq':  return `\${LEN(${v})} = ${rule.value}`
        case 'length_neq': return `\${LEN(${v})} != ${rule.value}`
        case 'length_gt':  return `\${LEN(${v})} > ${rule.value}`
        case 'length_gte': return `\${LEN(${v})} >= ${rule.value}`
        case 'length_lt':  return `\${LEN(${v})} < ${rule.value}`
        case 'length_lte': return `\${LEN(${v})} <= ${rule.value}`
        case 'eq':         return `"${v}" = "${rule.value}"`
        case 'neq':        return `"${v}" != "${rule.value}"`
        case 'gt':         return `${v} > ${rule.value}`
        case 'gte':        return `${v} >= ${rule.value}`
        case 'lt':         return `${v} < ${rule.value}`
        case 'lte':        return `${v} <= ${rule.value}`
        case 'contains':   return `\${REGEX("${escapeRegex(rule.value ?? '')}",${v})} = 1`
        case 'regex':      return `\${REGEX("${rule.value}",${v})} = 1`
    }
}

// GotoIf(condition?label1:label2) — destino omitido = continua na próxima priority do mesmo exten.
// "or": qualquer regra batendo já pula pro "-matched" (mesmo truque de GotoIfTime em
// timecondition.repository.ts); nenhuma bateu = cai no falseRoute.
// "and": cada regra que falhar pula direto pro "-fail" (falseRoute); todas passando = cai no trueRoute.
export function buildDialplan(
    id: string,
    name: string,
    combinator: Combinator,
    rules: VariableRule[],
    trueAsterisk: string | null,
    falseAsterisk: string | null,
): DialplanRow[] {
    const context = VARCOND_CONTEXT
    const entry = varCondEntry(id)
    const entries: DialplanRow[] = [{ context, exten: entry, priority: 1, app: 'NoOp', appdata: `VariableCondition: ${name}` }]

    let priority = 2

    if (combinator === 'or') {
        const matched = varMatched(entry)
        for (const rule of rules) {
            entries.push({ context, exten: entry, priority, app: 'GotoIf', appdata: `$[${buildExpr(rule)}]?${matched},1` })
            priority++
        }
        entries.push({ context, exten: entry, priority, app: falseAsterisk ? 'Goto' : 'Hangup', appdata: falseAsterisk })
        entries.push({ context, exten: matched, priority: 1, app: trueAsterisk ? 'Goto' : 'Hangup', appdata: trueAsterisk })
    } else {
        const fail = varFail(entry)
        for (const rule of rules) {
            entries.push({ context, exten: entry, priority, app: 'GotoIf', appdata: `$[${buildExpr(rule)}]?:${fail},1` })
            priority++
        }
        entries.push({ context, exten: entry, priority, app: trueAsterisk ? 'Goto' : 'Hangup', appdata: trueAsterisk })
        entries.push({ context, exten: fail, priority: 1, app: falseAsterisk ? 'Goto' : 'Hangup', appdata: falseAsterisk })
    }

    return entries
}

export const VariableConditionRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de VariableCondition.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${VARCOND_CONTEXT}:${asteriskId}`, async () => {
            const conditions = await prisma.variableCondition.findMany({ where: { companyId } })
            const entries: DialplanRow[] = []
            for (const c of conditions) {
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(c.trueRoute as RouteDestination),
                    resolveRoute(c.falseRoute as RouteDestination),
                ])
                entries.push(...buildDialplan(c.id, c.name, c.combinator as Combinator, c.rules as VariableRule[], trueAsterisk, falseAsterisk))
            }
            await writeContextFile(VARCOND_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
