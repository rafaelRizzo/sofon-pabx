import { isIP } from 'net'
import { lookup } from 'dns/promises'
import { AppError } from '../errors/app.error'

// Bloqueia SSRF: só http/https e nunca resolve pra loopback/privado/link-local/ULA/metadata.
// Resolve DNS antes de liberar pra impedir rebinding (hostname público apontando pra IP interno).
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
        return false
    }
    if (v === 6) {
        const lower = ip.toLowerCase()
        if (lower === '::' || lower === '::1') return true                // unspecified / loopback
        if (lower.startsWith('fe80')) return true                         // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)       // IPv4-mapped
        if (mapped) return isBlockedIp(mapped[1]!)
        return false
    }
    return false
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw new AppError('URL inválida', 400)
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new AppError('Protocolo não permitido (apenas http/https)', 400)
    }

    const host = url.hostname
    let addresses: { address: string }[]
    if (isIP(host)) {
        addresses = [{ address: host }]
    } else {
        try {
            addresses = await lookup(host, { all: true })
        } catch {
            throw new AppError('Não foi possível resolver o host', 400)
        }
    }

    for (const { address } of addresses) {
        if (isBlockedIp(address)) {
            throw new AppError('Destino de rede não permitido (host interno/privado)', 400)
        }
    }
}
