// Regras compartilhadas de segurança pra qualquer valor que vira texto literal ou referência de
// variável dentro de uma linha de dialplan gerada (Set(), GotoIf($[...]), etc). Usado por
// variables e variable-conditions — módulos onde o usuário controla nome de variável/valor/regex
// que acabam interpolados direto na expressão Asterisk.

// Interpolação é limitada a variáveis de canal e a um allowlist fechado de funções somente-leitura.
// Nunca aceitar funções arbitrárias: SHELL(), CURL(), FILE() transformariam um campo configurável
// pela API em execução de comando/leitura de arquivo no processo Asterisk.
const ALLOWED_INTERPOLATION = /\$\{(?:[A-Za-z_][A-Za-z0-9_]*|CALLERID\((?:num|name|ani|rdnis|dnid)\)|DB\([A-Za-z0-9_/-]+\))\}/g

// Referência de variável "crua" (sem os `${}` ao redor) — mesmo allowlist do ALLOWED_INTERPOLATION,
// usado onde o campo é o NOME da variável/função (ex: VariableCondition.rules[].variable), que o
// repository embrulha em `${...}` antes de gerar a linha de dialplan.
export const SAFE_VARIABLE_REF_REGEX = /^(?:[A-Za-z_][A-Za-z0-9_]*|CALLERID\((?:num|name|ani|rdnis|dnid)\)|DB\([A-Za-z0-9_/-]+\))$/

export const isSafeDialplanValue = (value: string) => {
    const literal = value.replace(ALLOWED_INTERPOLATION, '')
    return !/["\\(),;${}\x00-\x1f\x7f]/.test(literal)
}
