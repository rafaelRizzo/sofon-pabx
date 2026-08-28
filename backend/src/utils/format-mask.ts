// Motor de máscara do Formatter Node (ver src/asterisk/transport/agi-server.ts::handleFormatterNode).
// Legenda: '0' = 1 dígito, 'A' = 1 letra, '*' = 1 alfanumérico qualquer, qualquer outro caractere é
// literal (não consome nada do valor de entrada). Testa as máscaras em ordem, usa a primeira cujo
// número de tokens consumidores bate com o tamanho do valor já limpo (só dígitos/letras).
export type MaskMatch = { matched: string; output: string }

const CONSUMING_TOKENS = new Set(['0', 'A', '*'])

function matchesClass(token: string, char: string): boolean {
    if (token === '0') return /[0-9]/.test(char)
    if (token === 'A') return /[A-Za-z]/.test(char)
    return /[0-9A-Za-z]/.test(char) // '*'
}

function countConsumingTokens(mask: string): number {
    let count = 0
    for (const ch of mask) if (CONSUMING_TOKENS.has(ch)) count++
    return count
}

function tryApplyMask(cleanValue: string, mask: string): string | null {
    let i = 0
    let output = ''
    for (const ch of mask) {
        if (!CONSUMING_TOKENS.has(ch)) {
            output += ch
            continue
        }
        const char = cleanValue[i]
        if (char === undefined || !matchesClass(ch, char)) return null
        output += char
        i++
    }
    return output
}

export function applyMask(rawValue: string, masks: string[]): MaskMatch | null {
    const cleanValue = rawValue.replace(/[^0-9A-Za-z]/g, '')
    for (const mask of masks) {
        if (countConsumingTokens(mask) !== cleanValue.length) continue
        const output = tryApplyMask(cleanValue, mask)
        if (output !== null) return { matched: mask, output }
    }
    return null
}
