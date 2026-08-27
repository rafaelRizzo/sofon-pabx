// Defesa contra ReDoS (catastrophic backtracking) em regex fornecida pelo usuário
// (RoutingRule.conditions.callerIdPattern, testada em todo inbound call no processo worker
// singleton - um padrão exponencial trava o roteamento de TODAS as empresas, não só da dona
// da regra). ReDoS geral é indecidível, então isto é heurística: rejeita a assinatura mais comum
// (grupo quantificado contendo por sua vez um quantificador interno, ex: (a+)+, (a*)*, (a+)*).
// Defesa real e determinística é o cap de tamanho da string testada em runtime (ver
// routing-rules.service.ts) - mesmo um padrão que escape desta heurística tem o blowup limitado
// pelo tamanho de entrada.
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*?]|\([^()]*\{\d*,?\d*\}[^()]*\)[+*?]/

export function isSafeRegexPattern(pattern: string): boolean {
    if (pattern.length > 100) return false
    if (NESTED_QUANTIFIER.test(pattern)) return false
    try {
        new RegExp(pattern)
        return true
    } catch {
        return false
    }
}
