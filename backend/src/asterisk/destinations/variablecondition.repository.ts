import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { VARCOND_CONTEXT, varCondEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

export { VARCOND_CONTEXT, varCondEntry }

const env = validateEnv()
const buildAgiUrl = (id: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/varcond,${id}`

export type VariableRuleOperator =
    | 'filled' | 'empty'
    | 'length_eq' | 'length_neq' | 'length_gt' | 'length_gte' | 'length_lt' | 'length_lte'
    | 'eq' | 'neq' | 'contains' | 'regex'
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'cpf' | 'cnpj'

export type VariableRule = { variable: string; operator: VariableRuleOperator; value?: string }
export type Combinator = 'and' | 'or'

// Checksum de CPF/CNPJ como aritmética JS pura, avaliada no AGI server com o valor REAL da
// variável em mãos - substitui a versão anterior que montava a conta como texto interpolado num
// $[...] do Asterisk (ver histórico do arquivo). Essa versão anterior tinha dois problemas:
// 1) offsets fixos (${VAR:baseLen:1}) em valor mais curto que o esperado viravam slice vazio,
//    gerando "$[( = (...))]" - erro de sintaxe no ast_expr2 (não "falso", erro de parse mesmo),
//    logado toda vez que alguém digitava um CPF/CNPJ de tamanho errado - o caso mais comum de uso.
// 2) qualquer operador que interpola o VALOR EM TEMPO REAL da variável (eq/contains/regex/filled,
//    não só cpf/cnpj) fica vulnerável a esse valor conter aspas/parênteses e quebrar o parser -
//    dado vindo de CNAM/CALLERID(name) é controlado por quem liga, não por quem configura o fluxo.
// Avaliar em JS elimina as duas classes de bug de uma vez: sem parser de expressão nenhum pra
// escapar, só comparação de string/número normal.
type ChecksumSpec = {
    length: number       // 11 (CPF) ou 14 (CNPJ)
    baseLen: number       // caracteres antes dos 2 dígitos verificadores: 9 (CPF) ou 12 (CNPJ)
    weights1: number[]    // pesos do 1º dígito verificador, length = baseLen
    weights2: number[]    // pesos do 2º dígito verificador, length = baseLen + 1 (último = peso do dv1)
    excludeRepeated: boolean // exclui 000...0..999...9: matematicamente válidos, mas fake conhecido (só CPF)
    // CNPJ alfanumérico (IN RFB 2.229/2024): a raiz (12 primeiros caracteres) pode ter A-Z além de
    // 0-9, valor de cada posição = code(char) - 48 (mesma fórmula pros dígitos: '0'-48=0..'9'-48=9,
    // 'A'-48=17..'Z'-48=42). Os 2 dígitos verificadores continuam sempre numéricos. CPF nunca ganhou
    // esse formato (é identificador de pessoa física, não de empresa) - fica 100% numérico.
    alphanumericBase: boolean
}

const CPF_SPEC: ChecksumSpec = {
    length: 11, baseLen: 9,
    weights1: [10, 9, 8, 7, 6, 5, 4, 3, 2],
    weights2: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    excludeRepeated: true,
    alphanumericBase: false,
}

const CNPJ_SPEC: ChecksumSpec = {
    length: 14, baseLen: 12,
    weights1: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    weights2: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    excludeRepeated: false,
    alphanumericBase: true,
}

const checkDigit = (sum: number) => ((sum * 10) % 11) % 10

function computeCheckDigits(baseDigits: number[], spec: ChecksumSpec): [number, number] {
    const sum1 = spec.weights1.reduce((acc, w, i) => acc + baseDigits[i]! * w, 0)
    const dv1 = checkDigit(sum1)
    const extended = [...baseDigits, dv1]
    const sum2 = spec.weights2.reduce((acc, w, i) => acc + extended[i]! * w, 0)
    return [dv1, checkDigit(sum2)]
}

// função pura, testável isoladamente (ver __tests__/variablecondition-repository.service.test.ts)
export function validChecksum(value: string, spec: ChecksumSpec): boolean {
    if (value.length !== spec.length) return false

    const base = value.slice(0, spec.baseLen)
    const checkPart = value.slice(spec.baseLen)
    const bodyPattern = spec.alphanumericBase ? /^[0-9A-Z]+$/ : /^[0-9]+$/
    if (!bodyPattern.test(base) || !/^\d{2}$/.test(checkPart)) return false
    if (spec.excludeRepeated && new Set(value).size === 1) return false

    const baseDigits = [...base].map((c) => c.charCodeAt(0) - 48)
    const [dv1, dv2] = computeCheckDigits(baseDigits, spec)
    return checkPart === `${dv1}${dv2}`
}

// Avalia uma regra contra o valor REAL da variável (já resolvido pelo AGI via GET VARIABLE, que
// entende função de canal tipo CALLERID(num) nativamente) - função pura, sem I/O, testável
// isoladamente. `rule.value` já vem validado pelo schema (sem aspas/backslash, numérico quando o
// operador exige), mas isso não importa mais aqui: não tem string sendo montada pra nenhum parser.
export function evaluateRule(value: string, rule: VariableRule): boolean {
    const ruleValue = rule.value ?? ''
    switch (rule.operator) {
        case 'filled': return value !== ''
        case 'empty': return value === ''
        case 'length_eq': return value.length === Number(ruleValue)
        case 'length_neq': return value.length !== Number(ruleValue)
        case 'length_gt': return value.length > Number(ruleValue)
        case 'length_gte': return value.length >= Number(ruleValue)
        case 'length_lt': return value.length < Number(ruleValue)
        case 'length_lte': return value.length <= Number(ruleValue)
        case 'eq': return value === ruleValue
        case 'neq': return value !== ruleValue
        case 'contains': return value.includes(ruleValue)
        case 'regex':
            // padrão configurado por quem monta o fluxo (mesma confiança de antes, quando rodava via
            // Asterisk REGEX()) - sintaxe JS/PCRE-like, não POSIX ERE puro como o Asterisk usava; pattern
            // inválido não derruba a chamada, só não bate (mesmo espírito de "nunca lançar" do AGI server)
            try {
                return ruleValue ? new RegExp(ruleValue).test(value) : false
            } catch {
                return false
            }
        case 'gt': return Number(value) > Number(ruleValue)
        case 'gte': return Number(value) >= Number(ruleValue)
        case 'lt': return Number(value) < Number(ruleValue)
        case 'lte': return Number(value) <= Number(ruleValue)
        case 'cpf': return validChecksum(value, CPF_SPEC)
        case 'cnpj': return validChecksum(value, CNPJ_SPEC)
    }
}

export function evaluateRules(combinator: Combinator, results: boolean[]): boolean {
    return combinator === 'or' ? results.some(Boolean) : results.every(Boolean)
}

// Dialplan de uma VariableCondition é sempre o mesmo par fixo (AGI + Hangup) - mesmo padrão de
// RequestTemplateRepository/IxcNodeRepository. Quem varia (rules/combinator/rotas) é lido pelo AGI
// server em tempo de chamada via o id no agiUrl (ver handleVariableCondition em agi-server.ts).
export const VariableConditionRepository = {
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${VARCOND_CONTEXT}:${asteriskId}`, async () => {
            const conditions = await prisma.variableCondition.findMany({ where: { companyId }, select: { id: true } })
            const entries: DialplanRow[] = conditions.flatMap(({ id }) => {
                const exten = varCondEntry(id)
                return [
                    { context: VARCOND_CONTEXT, exten, priority: 1, app: 'AGI', appdata: buildAgiUrl(id) },
                    { context: VARCOND_CONTEXT, exten, priority: 2, app: 'Hangup', appdata: null },
                ]
            })
            await writeContextFile(VARCOND_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
