// Espelha backend/src/utils/format-mask.ts (motor de máscara do Formatter Node) - duplicado aqui só
// pra alimentar o testador em tempo real do form (components/FormatterNodes/formatter-node-form-dialog.tsx),
// sem bater na API a cada tecla digitada.
const CONSUMING_TOKENS = new Set(["0", "A", "*"])

function matchesClass(token: string, char: string): boolean {
    if (token === "0") return /[0-9]/.test(char)
    if (token === "A") return /[A-Za-z]/.test(char)
    return /[0-9A-Za-z]/.test(char) // '*'
}

function countConsumingTokens(mask: string): number {
    let count = 0
    for (const ch of mask) if (CONSUMING_TOKENS.has(ch)) count++
    return count
}

function tryApplyMask(cleanValue: string, mask: string): string | null {
    let i = 0
    let output = ""
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

export function cleanMaskValue(rawValue: string): string {
    return rawValue.replace(/[^0-9A-Za-z]/g, "")
}

// Índice da primeira máscara (respeitando a ordem do array) cujo nº de tokens bate com o valor
// limpo - mesmo critério do backend, usado aqui só pra destacar a linha vencedora na lista.
export function findMatchingMaskIndex(cleanValue: string, masks: string[]): number {
    return masks.findIndex(
        (mask) => countConsumingTokens(mask) === cleanValue.length && tryApplyMask(cleanValue, mask) !== null
    )
}

export function applyMaskAtIndex(cleanValue: string, mask: string): string | null {
    return tryApplyMask(cleanValue, mask)
}

export type MaskSegment =
    | { kind: "literal"; text: string }
    | { kind: "digit" | "letter" | "alnum"; count: number }

const TOKEN_KIND: Record<string, "digit" | "letter" | "alnum"> = {
    "0": "digit",
    A: "letter",
    "*": "alnum",
}

// Só uso de apresentação (decompõe a máscara em "texto fixo" vs "buracos" pro usuário enxergar
// visualmente onde dá pra colocar um prefixo/sufixo) - não participa da validação/aplicação real.
export function describeMask(mask: string): MaskSegment[] {
    const segments: MaskSegment[] = []
    for (const ch of mask) {
        const tokenKind = TOKEN_KIND[ch]
        const last = segments[segments.length - 1]
        if (tokenKind) {
            if (last && last.kind === tokenKind) last.count++
            else segments.push({ kind: tokenKind, count: 1 })
        } else if (last && last.kind === "literal") {
            last.text += ch
        } else {
            segments.push({ kind: "literal", text: ch })
        }
    }
    return segments
}

export type MaskParts = { prefix: string; core: string; suffix: string }

// Divide a máscara em 3 partes editáveis - tudo antes do 1º token é prefixo, tudo depois do
// último é sufixo, o miolo (com os tokens e a pontuação entre eles, ex: "(00) 00000-0000")
// continua junto como "padrão". Split determinístico, não ambíguo pra qualquer máscara válida
// (>= 1 token) - alimenta os campos Prefixo/Padrão/Sufixo do form (join desfaz o split).
export function splitMaskParts(mask: string): MaskParts {
    let first = -1
    let last = -1
    for (let i = 0; i < mask.length; i++) {
        if (TOKEN_KIND[mask[i] as string]) {
            if (first === -1) first = i
            last = i
        }
    }
    if (first === -1) return { prefix: "", core: mask, suffix: "" }
    return {
        prefix: mask.slice(0, first),
        core: mask.slice(first, last + 1),
        suffix: mask.slice(last + 1),
    }
}

export function joinMaskParts(parts: MaskParts): string {
    return `${parts.prefix}${parts.core}${parts.suffix}`
}
