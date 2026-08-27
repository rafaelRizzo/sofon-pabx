import { prisma } from '../../lib/prisma'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { VARCOND_CONTEXT, varCondEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'
import { nodeExitCheck } from '../flows/flow-node-runtime'

export { VARCOND_CONTEXT, varCondEntry }

export type VariableRuleOperator =
    | 'filled' | 'empty'
    | 'length_eq' | 'length_neq' | 'length_gt' | 'length_gte' | 'length_lt' | 'length_lte'
    | 'eq' | 'neq' | 'contains' | 'regex'
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'cpf' | 'cnpj'

export type VariableRule = { variable: string; operator: VariableRuleOperator; value?: string }
export type Combinator = 'and' | 'or'

const varMatched = (entry: string) => `${entry}-matched`

// escapa metacaracteres de regex POSIX ERE (usado pelo Asterisk REGEX()) - só usado internamente
// pra transformar um "contains" (substring literal) num pattern seguro, nunca em texto vindo direto
// do usuário sem passar por aqui (schema já proíbe aspas/backslash em `value`, ver variable-condition.schema.ts)
function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Validação de dígito verificador (checksum) de CPF/CNPJ como aritmética Asterisk pura, sem
// AGI/código externo, pra não sair do padrão "buildExpr é função pura sem I/O" deste arquivo.
// Cada dígito é extraído via ${VAR:offset:1} (resolvido pelo dialplan ANTES de chegar no
// avaliador de expressão $[...], então "fatiar + multiplicar" funciona direto como texto).
// Truque "resto<2?0:11-resto" sem condicional: ((soma*10)%11)%10, equivalente pros 11 valores
// possíveis de resto (0..10), ver prova em CLAUDE.md/histórico do PR.
// Limitação conhecida: só valida CNPJ numérico tradicional. O formato alfanumérico (IN RFB
// 2.229/2024) exigiria conversão char→código ASCII, que o ast_expr2 não tem. Não bloqueante pro
// caso de uso principal (dígitos vindos de IVR/DTMF são sempre numéricos).
type ChecksumSpec = {
    length: number       // 11 (CPF) ou 14 (CNPJ)
    baseLen: number      // dígitos antes dos verificadores: 9 (CPF) ou 12 (CNPJ)
    weights1: number[]   // pesos do 1º dígito verificador, length = baseLen
    weights2: number[]   // pesos do 2º dígito verificador, length = baseLen + 1 (último = peso do dv1)
    excludeRepeated: boolean // exclui 000...0..999...9: matematicamente válidos, mas fake conhecido (só CPF)
}

const CPF_SPEC: ChecksumSpec = {
    length: 11, baseLen: 9,
    weights1: [10, 9, 8, 7, 6, 5, 4, 3, 2],
    weights2: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    excludeRepeated: true,
}

const CNPJ_SPEC: ChecksumSpec = {
    length: 14, baseLen: 12,
    weights1: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    weights2: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    excludeRepeated: false,
}

const slice = (variable: string, offset: number) => `\${${variable}:${offset}:1}`

// Soma ponderada sempre entre parênteses, obrigatório: no ast_expr2, */% têm precedência sobre
// +, então uma soma sem parênteses quebra o cálculo do módulo em checkDigit().
function weightedSum(variable: string, weights: number[], extraTerm?: string): string {
    const terms = weights.map((w, i) => `(${slice(variable, i)}*${w})`)
    if (extraTerm) terms.push(extraTerm)
    return `(${terms.join('+')})`
}

const checkDigit = (sumExpr: string) => `(((${sumExpr}*10)%11)%10)`

function checksumExpr(variable: string, spec: ChecksumSpec): string {
    const dv1 = checkDigit(weightedSum(variable, spec.weights1))
    const dv2Weight = spec.weights2[spec.baseLen]
    const dv2 = checkDigit(weightedSum(variable, spec.weights2.slice(0, spec.baseLen), `(${dv1}*${dv2Weight})`))

    const clauses = [
        `(\${LEN(\${${variable}})} = ${spec.length})`,
        `(\${REGEX("^[0-9]{${spec.length}}$",\${${variable}})} = 1)`,
        ...(spec.excludeRepeated
            ? Array.from({ length: 10 }, (_, d) => `("\${${variable}}" != "${String(d).repeat(spec.length)}")`)
            : []),
        `(${slice(variable, spec.baseLen)} = ${dv1})`,
        `(${slice(variable, spec.baseLen + 1)} = ${dv2})`,
    ]
    return clauses.join(' & ')
}

// mesmo contrato de resolveRoute() em timecondition.repository.ts - "context,exten,priority" ou null
async function resolveRoute(route: RouteDestination): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(route)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

// Monta a expressão booleana Asterisk ($[...]) equivalente a uma regra - função pura, sem I/O,
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
        case 'cpf':        return checksumExpr(rule.variable, CPF_SPEC)
        case 'cnpj':       return checksumExpr(rule.variable, CNPJ_SPEC)
    }
}

// GotoIf(condition?label1:label2) - destino omitido = continua na próxima priority do mesmo exten.
// "or": qualquer regra batendo já pula pro "-matched" (mesmo truque de GotoIfTime em
// timecondition.repository.ts); nenhuma bateu = cai no falseRoute.
// "and": cada regra que falhar pula direto pro "-matched" (mesmo exten de destino do "or" - o nome
// não indica true/false, é só o alvo de convergência do loop; ver NoOp logo antes de cada Goto/Hangup
// pra saber qual branch foi de fato tomado sem precisar interpretar o appdata do GotoIf no log)
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
    const matched = varMatched(entry)
    const entries: DialplanRow[] = [{ context, exten: entry, priority: 1, app: 'NoOp', appdata: `VariableCondition: ${name}` }]

    let priority = 2

    if (combinator === 'or') {
        for (const rule of rules) {
            entries.push({ context, exten: entry, priority, app: 'GotoIf', appdata: `$[${buildExpr(rule)}]?${matched},1` })
            priority++
        }
        entries.push({ context, exten: entry, priority, app: 'NoOp', appdata: 'VariableCondition: NOT MATCHED' })
        entries.push({ context, exten: entry, priority: priority + 1, app: falseAsterisk ? 'Goto' : 'Hangup', appdata: falseAsterisk })
        entries.push({ context, exten: matched, priority: 1, app: 'NoOp', appdata: 'VariableCondition: MATCHED' })
        entries.push({ context, exten: matched, priority: 2, app: trueAsterisk ? 'Goto' : 'Hangup', appdata: trueAsterisk })
    } else {
        for (const rule of rules) {
            entries.push({ context, exten: entry, priority, app: 'GotoIf', appdata: `$[${buildExpr(rule)}]?:${matched},1` })
            priority++
        }
        entries.push({ context, exten: entry, priority, app: 'NoOp', appdata: 'VariableCondition: MATCHED' })
        entries.push({ context, exten: entry, priority: priority + 1, app: trueAsterisk ? 'Goto' : 'Hangup', appdata: trueAsterisk })
        entries.push({ context, exten: matched, priority: 1, app: 'NoOp', appdata: 'VariableCondition: NOT MATCHED' })
        entries.push({ context, exten: matched, priority: 2, app: falseAsterisk ? 'Goto' : 'Hangup', appdata: falseAsterisk })
    }

    return entries
}

export const VariableConditionRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco - chamado depois de qualquer create/update/delete de VariableCondition.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${VARCOND_CONTEXT}:${asteriskId}`, async () => {
            const [conditions, edges] = await Promise.all([
                prisma.variableCondition.findMany({ where: { companyId } }),
                FlowEdgeRepository.getBySource(companyId, 'variablecondition'),
            ])
            const entries: DialplanRow[] = []
            for (const c of conditions) {
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(edges.get(c.id)?.true ?? null),
                    resolveRoute(edges.get(c.id)?.false ?? null),
                ])
                const rows = buildDialplan(c.id, c.name, c.combinator as Combinator, c.rules as VariableRule[], trueAsterisk, falseAsterisk)
                const entry = varCondEntry(c.id)
                const matched = varMatched(entry)
                const mainPort = c.combinator === 'or' ? 'false' : 'true'
                const matchedPort = c.combinator === 'or' ? 'true' : 'false'
                const withNodeExits: DialplanRow[] = []
                for (const row of rows) {
                    if ((row.exten === entry || row.exten === matched) && (row.app === 'Goto' || row.app === 'Hangup')) {
                        const port = row.exten === entry ? mainPort : matchedPort
                        withNodeExits.push(nodeExitCheck(VARCOND_CONTEXT, row.exten, row.priority, port))
                        withNodeExits.push({ ...row, priority: row.priority + 1 })
                    } else withNodeExits.push(row)
                }
                entries.push(...withNodeExits)
            }
            await writeContextFile(VARCOND_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
