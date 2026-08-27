const dateTimeParts = (date: Date, timeZone: string): Record<string, string> => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date)

    const map: Record<string, string> = {}
    for (const part of parts) map[part.type] = part.value
    return map
}

const offsetSuffix = (date: Date, timeZone: string): string => {
    const map = dateTimeParts(date, timeZone)
    const asUTC = Date.UTC(+map.year!, +map.month! - 1, +map.day!, +map.hour!, +map.minute!, +map.second!)
    const offsetMin = Math.round((asUTC - date.getTime()) / 60000)

    const sign = offsetMin < 0 ? '-' : '+'
    const abs = Math.abs(offsetMin)
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

// Formata um Date como ISO 8601 com offset fixo do timezone informado (ex: -03:00),
// em vez do "Z" (UTC) padrão do toISOString - evita reparse de encode no zod (ver src/schemas/responses.ts)
export function toTzISOString(date: Date, timeZone: string): string {
    const map = dateTimeParts(date, timeZone)
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${offsetSuffix(date, timeZone)}`
}

// CDR do Asterisk grava start/answer/endtime como TIMESTAMP sem timezone, com a hora LOCAL do SO
// (America/Sao_Paulo, ver setups/install-asterisk.sh) - o driver pg lê esses dígitos como se fossem UTC,
// então o Date resultante já carrega a hora local "disfarçada" de UTC. Formata direto pelos dígitos naive
// em vez de toTzISOString, que reconverteria assumindo (incorretamente) que o Date é um instante UTC real.
export function formatNaiveLocalISOString(date: Date, timeZone: string): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = date.getUTCFullYear()
    const mo = pad(date.getUTCMonth() + 1)
    const d = pad(date.getUTCDate())
    const h = pad(date.getUTCHours())
    const mi = pad(date.getUTCMinutes())
    const s = pad(date.getUTCSeconds())
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${offsetSuffix(date, timeZone)}`
}

// Percorre a árvore de resposta coletando companyId de cada registro, pra resolver o timezone de cada empresa em lote antes de formatar
export function collectCompanyIds(value: unknown, ids: Set<string> = new Set()): Set<string> {
    if (Array.isArray(value)) {
        for (const v of value) collectCompanyIds(v, ids)
        return ids
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        const obj = value as Record<string, unknown>
        if (typeof obj.companyId === 'string') ids.add(obj.companyId)
        for (const key of Object.keys(obj)) collectCompanyIds(obj[key], ids)
    }
    return ids
}

// Um registro é a própria Company quando carrega seu próprio campo timezone - nesse caso ele já é a fonte, sem precisar de lookup no tzByCompanyId
function resolveTimeZone(obj: Record<string, unknown>, tzByCompanyId: Map<string, string>, inherited: string): string {
    if (typeof obj.id === 'string' && typeof obj.timezone === 'string') return obj.timezone
    if (typeof obj.companyId === 'string') return tzByCompanyId.get(obj.companyId) ?? inherited
    return inherited
}

export function formatDatesDeep(value: unknown, timeZone: string, tzByCompanyId: Map<string, string> = new Map()): unknown {
    if (value instanceof Date) return toTzISOString(value, timeZone)
    if (Array.isArray(value)) return value.map((v) => formatDatesDeep(v, timeZone, tzByCompanyId))
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        const scopedTimeZone = resolveTimeZone(obj, tzByCompanyId, timeZone)
        for (const key of Object.keys(obj)) obj[key] = formatDatesDeep(obj[key], scopedTimeZone, tzByCompanyId)
    }
    return value
}
