// Parser puro (sem I/O) do protocolo AMI — separado de ami-events.ts pra ser testável direto com
// strings in/out. Registros AMI (Response/Event) são blocos "Chave: Valor" terminados por linha
// em branco (\r\n\r\n); não cobre "Response: Follows" (Action: Command), que não é usado neste fluxo.

export type AmiBlock = Record<string, string>

export function parseAmiBlock(raw: string): AmiBlock {
    const block: AmiBlock = {}
    for (const line of raw.split('\r\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        block[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return block
}

// Consome o buffer acumulado do socket, devolve os blocos completos + o resto não consumido
// (pode terminar no meio de um bloco se o TCP fragmentar o pacote)
export function extractAmiBlocks(buffer: string): { blocks: AmiBlock[]; rest: string } {
    const parts = buffer.split('\r\n\r\n')
    const rest = parts.pop() ?? ''
    const blocks = parts.filter((p) => p.trim().length > 0).map(parseAmiBlock)
    return { blocks, rest }
}
