// Extrai o dump `asterisk.sql` de um backup do IssabelPBX inteiramente no navegador, sem nunca
// carregar o arquivo inteiro na memória: lê os cabeçalhos do .tar (blocos de 512 bytes) via
// Blob.slice(), que é preguiçoso/zero-copy até o .arrayBuffer() ser chamado - só o pedaço pequeno
// (mysqldb_asterisk.tgz, poucos MB) é efetivamente lido, mesmo num backup de vários GB com
// gravação/voicemail junto. Isso evita subir o backup inteiro pro servidor (ver migrations.service.ts
// no backend, que também aceita o .tar completo direto, caso essa extração falhe aqui).

const TAR_BLOCK = 512

function readCString(bytes: Uint8Array, start: number, len: number) {
    let end = start
    while (end < start + len && bytes[end] !== 0) end++
    return new TextDecoder().decode(bytes.subarray(start, end))
}

// Suporta ustar "plain file" (typeflag '0'/'\0') com nome curto (<100 chars) - suficiente pros
// nomes fixos que o backup do Issabel usa (mysqldb_asterisk.tgz, mysqldb_asterisk/asterisk.sql).
// Não implementa entradas GNU longname (typeflag 'L'), diretórios etc - se não achar a entrada
// pelo pattern, quem chama trata como "extração falhou" e cai no fallback (upload do arquivo cru).
async function findTarEntry(blob: Blob, pattern: RegExp): Promise<Blob | null> {
    let offset = 0
    const size = blob.size

    while (offset + TAR_BLOCK <= size) {
        const header = new Uint8Array(
            await blob.slice(offset, offset + TAR_BLOCK).arrayBuffer()
        )
        if (header.every((b) => b === 0)) break // dois blocos zerados = fim do arquivo

        const name = readCString(header, 0, 100)
        const sizeOctal = readCString(header, 124, 12).trim()
        const entrySize = sizeOctal ? Number.parseInt(sizeOctal, 8) : 0
        const typeflag = String.fromCharCode(header[156] ?? 0)

        if (pattern.test(name) && (typeflag === '0' || typeflag === '\0')) {
            return blob.slice(offset + TAR_BLOCK, offset + TAR_BLOCK + entrySize)
        }

        const entryBlocks = Math.ceil(entrySize / TAR_BLOCK)
        offset += TAR_BLOCK + entryBlocks * TAR_BLOCK
    }

    return null
}

async function decompressGzip(blob: Blob): Promise<Blob> {
    if (typeof DecompressionStream === "undefined") {
        throw new Error("Navegador sem suporte a DecompressionStream")
    }
    const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"))
    return new Response(stream).blob()
}

export class IssabelExtractError extends Error {}

/**
 * Recebe o arquivo selecionado pelo usuário - pode ser o backup .tar completo, só o
 * mysqldb_asterisk.tgz já isolado, ou o asterisk.sql já extraído - e devolve sempre o texto do
 * dump SQL. Lança IssabelExtractError com uma mensagem acionável quando não consegue.
 */
export async function extractIssabelSql(file: File): Promise<string> {
    const name = file.name.toLowerCase()

    if (name.endsWith(".sql")) return file.text()

    let dumpBlob: Blob
    if (name.endsWith(".tgz") || name.endsWith(".tar.gz")) {
        dumpBlob = file
    } else {
        const entry = await findTarEntry(file, /mysqldb_asterisk[^/]*\.(tgz|tar\.gz)$/i)
        if (!entry) {
            throw new IssabelExtractError(
                'Não encontrei "mysqldb_asterisk.tgz" dentro do arquivo - confirme que é o backup completo do Issabel'
            )
        }
        dumpBlob = entry
    }

    const innerTar = await decompressGzip(dumpBlob)
    const sqlEntry = await findTarEntry(innerTar, /(^|\/)asterisk\.sql$/i)
    if (!sqlEntry) {
        throw new IssabelExtractError(
            'Não encontrei "asterisk.sql" dentro do dump do banco - o formato pode ser diferente do esperado'
        )
    }
    return sqlEntry.text()
}
