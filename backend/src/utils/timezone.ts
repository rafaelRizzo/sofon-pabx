// Formata um Date como ISO 8601 com offset fixo do timezone informado (ex: -03:00),
// em vez do "Z" (UTC) padrão do toISOString — evita reparse de encode no zod (ver src/schemas/responses.ts)
export function toTzISOString(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date)

    const map: Record<string, string> = {}
    for (const part of parts) map[part.type] = part.value

    const asUTC = Date.UTC(+map.year!, +map.month! - 1, +map.day!, +map.hour!, +map.minute!, +map.second!)
    const offsetMin = Math.round((asUTC - date.getTime()) / 60000)

    const sign = offsetMin < 0 ? '-' : '+'
    const abs = Math.abs(offsetMin)
    const offHh = String(Math.floor(abs / 60)).padStart(2, '0')
    const offMm = String(abs % 60).padStart(2, '0')

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${sign}${offHh}:${offMm}`
}

export function formatDatesDeep(value: unknown, timeZone: string): unknown {
    if (value instanceof Date) return toTzISOString(value, timeZone)
    if (Array.isArray(value)) return value.map((v) => formatDatesDeep(v, timeZone))
    if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value as Record<string, unknown>)) {
            (value as Record<string, unknown>)[key] = formatDatesDeep((value as Record<string, unknown>)[key], timeZone)
        }
    }
    return value
}
