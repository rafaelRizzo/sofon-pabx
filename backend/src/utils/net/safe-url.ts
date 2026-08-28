import { isIP } from 'net'
import { lookup } from 'dns/promises'
import http from 'node:http'
import https from 'node:https'
import { AppError } from '../errors/app.error'

const MAX_RESPONSE_BYTES = 1024 * 1024

type SafeRequestInit = {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
}

type ResolvedUrl = {
    url: URL
    address: string
    family: 4 | 6
}

// Bloqueia SSRF: só http/https e nunca resolve pra loopback/privado/link-local/ULA/metadata.
// O IP aprovado também é fixado no socket da requisição; validar e depois deixar o cliente resolver
// o hostname outra vez abriria uma janela para DNS rebinding.
function isBlockedIp(ip: string): boolean {
    const v = isIP(ip)
    if (v === 4) {
        const p = ip.split('.').map(Number)
        if (p[0] === 0 || p[0] === 127) return true                       // "this host" / loopback
        if (p[0] === 10) return true                                      // privado
        if (p[0] === 172 && p[1]! >= 16 && p[1]! <= 31) return true       // privado
        if (p[0] === 192 && p[1] === 168) return true                     // privado
        if (p[0] === 169 && p[1] === 254) return true                     // link-local + metadata cloud
        if (p[0] === 100 && p[1]! >= 64 && p[1]! <= 127) return true      // CGNAT
        if (p[0] === 192 && p[1] === 0) return true                       // IETF protocol assignments
        if (p[0] === 192 && p[1] === 2) return true                       // TEST-NET-1
        if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true     // benchmark testing
        if (p[0] === 198 && p[1] === 51 && p[2] === 100) return true      // TEST-NET-2
        if (p[0] === 203 && p[1] === 0 && p[2] === 113) return true       // TEST-NET-3
        if (p[0]! >= 224) return true                                     // multicast/reserved
        return false
    }
    if (v === 6) {
        const lower = ip.toLowerCase()
        if (lower === '::' || lower === '::1') return true                // unspecified / loopback
        if (lower.startsWith('fe80')) return true                         // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA
        if (lower.startsWith('2001:db8')) return true                     // documentation range
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)       // IPv4-mapped
        if (mapped) return isBlockedIp(mapped[1]!)
        return false
    }
    return false
}

async function resolveSafeUrl(rawUrl: string): Promise<ResolvedUrl> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw new AppError('URL inválida', 400)
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new AppError('Protocolo não permitido (apenas http/https)', 400)
    }
    if (url.username || url.password) {
        throw new AppError('Credenciais na URL não são permitidas', 400)
    }

    const host = url.hostname
    let addresses: { address: string; family: number }[]
    if (isIP(host)) {
        addresses = [{ address: host, family: isIP(host) }]
    } else {
        try {
            addresses = await lookup(host, { all: true, verbatim: true })
        } catch {
            throw new AppError('Não foi possível resolver o host', 400)
        }
    }

    for (const { address } of addresses) {
        if (isBlockedIp(address)) {
            throw new AppError('Destino de rede não permitido (host interno/privado)', 400)
        }
    }

    const first = addresses[0]
    if (!first || (first.family !== 4 && first.family !== 6)) {
        throw new AppError('Não foi possível resolver um endereço IP válido', 400)
    }
    return { url, address: first.address, family: first.family }
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
    await resolveSafeUrl(rawUrl)
}

// Não segue redirects. Um redirect precisa ser tratado explicitamente pelo chamador e passar por
// esta mesma função, impedindo que um host público redirecione a chamada para a rede interna.
export async function safeFetch(rawUrl: string, init: SafeRequestInit = {}): Promise<Response> {
    const { url, address, family } = await resolveSafeUrl(rawUrl)
    const client = url.protocol === 'https:' ? https : http

    return new Promise<Response>((resolve, reject) => {
        const request = client.request({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || undefined,
            path: `${url.pathname}${url.search}`,
            method: init.method ?? 'GET',
            headers: init.headers,
            signal: init.signal,
            servername: url.protocol === 'https:' ? url.hostname : undefined,
            // Node chama lookup com options.all=true (Happy Eyeballs/autoSelectFamily, sempre ligado
            // no cliente http/https do Bun) e nesse modo espera callback(err, addresses[]), não
            // callback(err, address, family) - passar só a tripla faz o socket receber address
            // undefined e falhar com "Invalid IP address: undefined" antes mesmo da requisição sair
            // (silencioso: nenhuma tentativa de rede chega a acontecer, então nem timeout aparece).
            lookup: (_hostname, options, callback) => {
                const opts = options as { all?: boolean } | undefined
                if (opts?.all) callback(null, [{ address, family }])
                else callback(null, address, family)
            },
        }, (response) => {
            const chunks: Buffer[] = []
            let size = 0
            response.on('data', (chunk: Buffer) => {
                size += chunk.length
                if (size > MAX_RESPONSE_BYTES) {
                    response.destroy(new AppError('Resposta externa excede o limite permitido', 413))
                    return
                }
                chunks.push(chunk)
            })
            response.on('error', reject)
            response.on('end', () => {
                const headers = new Headers()
                for (const [key, value] of Object.entries(response.headers)) {
                    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
                }
                const status = response.statusCode ?? 502
                const body = status === 204 || status === 205 || status === 304 ? null : Buffer.concat(chunks)
                resolve(new Response(body, { status, headers }))
            })
        })
        request.on('error', reject)
        request.end(init.body)
    })
}
