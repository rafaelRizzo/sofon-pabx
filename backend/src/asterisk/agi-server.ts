import { prisma } from '../lib/prisma'
import { logger } from '../utils/logger'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'
import { assertSafeUrl } from '../utils/net/safe-url'
import type { RouteDestination } from '../schemas/route-destination.schema'
import type { VariableMapping } from '../modules/request-templates/schemas/request-template.schema'

// Servidor FastAGI — Asterisk conecta via AGI(agi://AGI_HOST:AGI_PORT/run,<requestTemplateId>) quando
// resolve um RouteDestination type: "request" (ver route.repository.ts dos módulos que usam
// RouteDestination). Protocolo AGI é estritamente request/response — nunca disparar dois comandos
// concorrentes no mesmo socket, a ordem das respostas quebra.

type AgiConn = {
    socket: Bun.Socket<AgiConn>
    buffer: string
    lineQueue: string[]
    lineResolvers: Array<(line: string) => void>
}

// Quando o Asterisk envia o ambiente AGI inteiro em um único pacote TCP, todas as linhas chegam
// de uma vez antes dos awaits seguintes registrarem resolvers — lineQueue armazena as linhas
// chegadas sem resolver pendente para entrega síncrona no próximo readLine.
function feedData(conn: AgiConn, chunk: string) {
    conn.buffer += chunk
    let idx: number
    while ((idx = conn.buffer.indexOf('\n')) !== -1) {
        const line = conn.buffer.slice(0, idx).replace(/\r$/, '')
        conn.buffer = conn.buffer.slice(idx + 1)
        const resolve = conn.lineResolvers.shift()
        if (resolve) resolve(line)
        else conn.lineQueue.push(line)
    }
}

function readLine(conn: AgiConn): Promise<string> {
    if (conn.lineQueue.length > 0) return Promise.resolve(conn.lineQueue.shift()!)
    return new Promise((resolve) => conn.lineResolvers.push(resolve))
}

async function readAgiEnv(conn: AgiConn): Promise<Record<string, string>> {
    const env: Record<string, string> = {}
    while (true) {
        const line = await readLine(conn)
        if (line === '') break
        const idx = line.indexOf(':')
        if (idx === -1) continue
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return env
}

// AGI exige valor entre aspas quando contém espaço — sempre quotar é seguro mesmo sem espaço
function agiQuote(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`
}

async function sendAgiCommand(conn: AgiConn, command: string): Promise<{ code: number; result: string; extra?: string }> {
    conn.socket.write(`${command}\n`)
    const line = await readLine(conn)
    const match = line.match(/^(\d{3})\s+result=(-?\S*)(?:\s+\((.*)\))?/)
    if (!match) return { code: 0, result: '' }
    return { code: Number(match[1]), result: match[2] ?? '', extra: match[3] }
}

async function agiGetVariable(conn: AgiConn, name: string): Promise<string | null> {
    const { result, extra } = await sendAgiCommand(conn, `GET VARIABLE ${name}`)
    return result === '1' ? (extra ?? '') : null
}

async function agiSetVariable(conn: AgiConn, name: string, value: string) {
    await sendAgiCommand(conn, `SET VARIABLE ${name} ${agiQuote(value)}`)
}

async function agiExecGoto(conn: AgiConn, target: { context: string; exten: string; priority: number }) {
    await sendAgiCommand(conn, `EXEC Goto ${target.context},${target.exten},${target.priority}`)
}

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g

// {{CALLERID(num)}}, {{EXTEN}}, {{qualquer_var_de_canal}} — resolvido via AGI GET VARIABLE, que já
// avalia funções de dialplan quando a expressão tem a forma FUNC(args)
async function resolvePlaceholders(conn: AgiConn, input: string): Promise<string> {
    const matches = [...input.matchAll(PLACEHOLDER_RE)]
    if (matches.length === 0) return input
    let result = input
    for (const m of matches) {
        const value = await agiGetVariable(conn, m[1]!.trim())
        result = result.replace(m[0], value ?? '')
    }
    return result
}

// Sequencial de propósito (nunca Promise.all) — comandos AGI não podem ser concorrentes no mesmo socket
async function resolvePlaceholdersDeep(conn: AgiConn, value: unknown): Promise<unknown> {
    if (typeof value === 'string') return resolvePlaceholders(conn, value)
    if (Array.isArray(value)) {
        const out: unknown[] = []
        for (const item of value) out.push(await resolvePlaceholdersDeep(conn, item))
        return out
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) out[k] = await resolvePlaceholdersDeep(conn, v)
        return out
    }
    return value
}

// avalia "data.client[0].id" sobre o JSON de resposta já parseado
function evalResponsePath(obj: unknown, path: string): unknown {
    const tokens = path.match(/[^.[\]]+/g) ?? []
    let current: any = obj
    for (const token of tokens) {
        if (current == null) return undefined
        current = current[token]
    }
    return current
}

async function handleRequestTemplate(conn: AgiConn, templateId: string) {
    const template = await prisma.requestTemplate.findUnique({ where: { id: templateId } })
    if (!template) {
        logger.warn({ event: 'agi.request_template.not_found', templateId })
        return
    }

    const url = await resolvePlaceholders(conn, template.url)
    const headersRaw = (template.headers as Record<string, string> | null) ?? {}
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(headersRaw)) headers[k] = await resolvePlaceholders(conn, v)

    const bodyRaw = template.body as Record<string, unknown> | null
    const body = bodyRaw ? await resolvePlaceholdersDeep(conn, bodyRaw) : undefined

    let success = false
    let parsed: unknown = null

    try {
        // SSRF: só libera http/https pra host externo (bloqueia loopback/privado/link-local/metadata)
        await assertSafeUrl(url)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), template.timeoutMs)
        try {
            const res = await fetch(url, {
                method: template.method,
                headers,
                body: body !== undefined && template.method !== 'GET' ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })
            success = res.ok
            try { parsed = await res.json() } catch { parsed = null }
        } finally {
            clearTimeout(timeout)
        }
    } catch (error) {
        logger.warn({
            event: 'agi.request_template.failed',
            templateId,
            message: error instanceof Error ? error.message : String(error),
        })
        success = false
    }

    const mappings = (template.variableMappings as VariableMapping[] | null) ?? []
    for (const mapping of mappings) {
        const value = evalResponsePath(parsed, mapping.path)
        if (value !== undefined) {
            await agiSetVariable(conn, mapping.variable, typeof value === 'string' ? value : JSON.stringify(value))
        }
    }

    logger.info({ event: 'agi.request_template.done', templateId, success, mappings: mappings.length })
    const dest = (success ? template.onSuccess : template.onError) as RouteDestination
    const target = await resolveRouteDestinationToDialplan(dest)
    if (target) await agiExecGoto(conn, target)
}

export function startAgiServer(host: string, port: number) {
    Bun.listen<AgiConn>({
        hostname: host,
        port,
        socket: {
            open(socket) {
                socket.data = { socket, buffer: '', lineQueue: [], lineResolvers: [] }
                handleConnection(socket.data).catch((error) => {
                    logger.error({ event: 'agi.session.error', message: error instanceof Error ? error.message : String(error) })
                }).finally(() => socket.end())
            },
            data(socket, chunk) {
                feedData(socket.data, chunk.toString('utf8'))
            },
            error(socket, error) {
                logger.error({ event: 'agi.socket.error', message: error.message })
            },
            close(socket) {
                for (const resolve of socket.data.lineResolvers) resolve('')
                socket.data.lineResolvers = []
            },
            drain() { },
        },
    })
    logger.info({ event: 'agi.server.started', host, port })
}

async function handleConnection(conn: AgiConn) {
    const env = await readAgiEnv(conn)
    const templateId = env['agi_arg_1']
    if (templateId) await handleRequestTemplate(conn, templateId)
}
