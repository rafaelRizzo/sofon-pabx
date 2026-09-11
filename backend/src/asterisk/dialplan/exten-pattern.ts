// Reimplementa o casamento de exten pattern do Asterisk (X/Z/N, [...], "." e "!" finais, literal sem
// "_") em TS - usado só pra DECIDIR se existe uma rota de saída candidata antes do AGI mandar EXEC GOTO
// pro contexto 'ramais' (ver handleTransferRoute em agi-server.ts). O casamento real de qual pattern
// "ganha" continua sendo feito pelo próprio Asterisk depois do Goto (ele já resolve por especificidade);
// esse matcher só evita o Goto às cegas quando não existe NENHUM candidato, pra manter o Congestion()
// do contexto [transfer] como fallback audível em vez de um Dial fantasma contra o pattern genérico de
// ramal (_XX.._XXXXXX, sempre presente) seguido de Hangup silencioso.
export function extenPatternMatches(pattern: string, dialed: string): boolean {
    if (!pattern.startsWith('_')) return pattern === dialed

    const body = pattern.slice(1)
    let regex = '^'
    let i = 0
    while (i < body.length) {
        const c = body[i]!
        if (c === 'X') regex += '[0-9]'
        else if (c === 'Z') regex += '[1-9]'
        else if (c === 'N') regex += '[2-9]'
        else if (c === '.') regex += '.+' // só válido no final do pattern, casa 1+ dígitos restantes
        else if (c === '!') regex += '.*' // idem, casa 0+ (match ganancioso imediato no Asterisk real)
        else if (c === '[') {
            const end = body.indexOf(']', i)
            if (end === -1) {
                regex += '\\['
                i++
                continue
            }
            regex += body.slice(i, end + 1)
            i = end
        } else {
            regex += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }
        i++
    }
    regex += '$'
    return new RegExp(regex).test(dialed)
}
