import os from 'node:os'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import { validateEnv } from '../../config/env'
import { getExtensionsStatus } from '../realtime/realtime.service'
import { DDD_TO_UF, extractDDD } from '../../utils/ddd.util'
import type { DashboardCallsByRegionQueryInput } from './schemas/dashboard.schema'

const TZ = process.env.TZ || 'America/Sao_Paulo'

// Mesmo formato usado em todo o projeto pra filtrar CDR por dia (ver cdr.service.ts) - string
// solta YYYY-MM-DD no fuso da empresa, sem conversão: startTime é naive-local (ver schema.prisma)
function localDateParts(): { today: string; yesterday: string; monthStart: string; yearStart: string } {
    const now = new Date()
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now) // YYYY-MM-DD
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(
        new Date(now.getTime() - 24 * 60 * 60 * 1000)
    )
    const year = today.slice(0, 4)
    const month = today.slice(5, 7)
    return { today, yesterday, monthStart: `${year}-${month}-01`, yearStart: `${year}-01-01` }
}

async function resolveAsteriskIds(companyIds?: string[]): Promise<string[]> {
    const companies = await prisma.company.findMany({
        where: companyIds ? { id: { in: companyIds } } : undefined,
        select: { asteriskId: true },
    })
    return companies.map((c) => c.asteriskId)
}

export const getDashboardOverview = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) {
        return {
            extensionsOnline: 0, extensionsOffline: 0,
            callsToday: 0, callsYesterday: 0, callsThisMonth: 0, callsThisYear: 0,
            callsOutboundToday: 0,
        }
    }

    const [extensions, asteriskIds] = await Promise.all([
        getExtensionsStatus(companyIds),
        resolveAsteriskIds(companyIds),
    ])

    const extensionsOnline = extensions.filter((e) => e.presence === 'online').length
    const extensionsOffline = extensions.length - extensionsOnline

    const { today, yesterday, monthStart, yearStart } = localDateParts()
    // asteriskIds vazio (empresas sem trunk cadastrado ainda não tem CDR) - filtro por lista vazia
    // do Prisma já retorna 0 corretamente, sem precisar de guarda extra
    const accountcode = { in: asteriskIds }

    const [callsToday, callsYesterday, callsThisMonth, callsThisYear, callsOutboundToday] = await Promise.all([
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${today}T00:00:00.000Z`) } } }),
        prisma.cdr.count({
            where: {
                accountcode,
                startTime: { gte: new Date(`${yesterday}T00:00:00.000Z`), lt: new Date(`${today}T00:00:00.000Z`) },
            },
        }),
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${monthStart}T00:00:00.000Z`) } } }),
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${yearStart}T00:00:00.000Z`) } } }),
        prisma.cdr.count({
            where: { accountcode, direction: 'outbound', startTime: { gte: new Date(`${today}T00:00:00.000Z`) } },
        }),
    ])

    return {
        extensionsOnline, extensionsOffline,
        callsToday, callsYesterday, callsThisMonth, callsThisYear,
        callsOutboundToday,
    }
}

// Extrai DDD de src (inbound)/dst (outbound) do CDR e agrega por UF (mapa não tem malha por DDD,
// ver docs do shadcnmaps) mantendo o breakdown por DDD dentro de cada UF pro tooltip do front.
// Projeção só de direction/src/dst (sem select completo) - agregação em JS, mesmo padrão de
// getExtensionsStatus (sem groupBy por substring no Prisma)
export const getDashboardCallsByRegion = async (
    companyIds: string[] | undefined,
    filter: Pick<DashboardCallsByRegionQueryInput, 'startDate' | 'endDate' | 'direction'>
) => {
    if (companyIds && companyIds.length === 0) return { regions: [] }

    const asteriskIds = await resolveAsteriskIds(companyIds)
    const direction = filter.direction

    const rows = await prisma.cdr.findMany({
        where: {
            accountcode: { in: asteriskIds },
            direction: direction === 'all' ? { in: ['inbound', 'outbound'] } : direction,
            ...((filter.startDate || filter.endDate) && {
                startTime: {
                    ...(filter.startDate && { gte: new Date(`${filter.startDate}T00:00:00.000Z`) }),
                    ...(filter.endDate && { lte: new Date(`${filter.endDate}T23:59:59.999Z`) }),
                },
            }),
        },
        select: { direction: true, src: true, dst: true },
    })

    const callsByDdd = new Map<string, number>()
    for (const row of rows) {
        const number = row.direction === 'outbound' ? row.dst : row.src
        const ddd = extractDDD(number)
        if (!ddd) continue
        callsByDdd.set(ddd, (callsByDdd.get(ddd) ?? 0) + 1)
    }

    const byUf = new Map<string, Map<string, number>>()
    for (const [ddd, calls] of callsByDdd) {
        const uf = DDD_TO_UF[ddd]!
        const entry = byUf.get(uf) ?? new Map<string, number>()
        entry.set(ddd, calls)
        byUf.set(uf, entry)
    }

    return {
        regions: [...byUf.entries()].map(([uf, byDdd]) => ({
            uf,
            calls: [...byDdd.values()].reduce((sum, n) => sum + n, 0),
            byDdd: [...byDdd.entries()]
                .map(([ddd, calls]) => ({ ddd, calls }))
                .sort((a, b) => b.calls - a.calls),
        })),
    }
}

// Mesmo path de cdr.controller.ts (MONITOR_BASE_DIR) - onde o MixMonitor sempre grava
const RECORDINGS_DIR = '/var/spool/asterisk/monitor'
const RECORDINGS_CACHE_MS = 5 * 60 * 1000

// Mesmo path fixo usado em setups/install-asterisk.sh (logger.conf) - messages/full com logrotate
const LOGS_DIR = '/var/log/asterisk'
const LOGS_CACHE_MS = 5 * 60 * 1000

let recordingsSizeCache: { bytes: number; at: number } | null = null
let logsSizeCache: { bytes: number; at: number } | null = null

async function runCommand(cmd: string[], timeoutMs: number): Promise<string> {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
    let timedOut = false
    const timeout = setTimeout(() => {
        timedOut = true
        proc.kill()
    }, timeoutMs)
    const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ])
    clearTimeout(timeout)
    if (timedOut) throw new AppError(`Comando "${cmd[0]}" excedeu o tempo limite`, 502)
    if (exitCode !== 0) throw new AppError(`Comando "${cmd[0]}" falhou: ${stderr.trim() || 'erro desconhecido'}`, 502)
    return stdout
}

// `df -B1 <path>` - header + 1 linha de dados: Filesystem 1B-blocks Used Available Use% Mounted.
// Extraído numa função pura (testável sem spawnar processo de verdade) do resto que chama Bun.spawn.
export function parseDfOutput(output: string): { totalBytes: number; usedBytes: number; freeBytes: number; usedPct: number } {
    const line = output.trim().split('\n').at(-1) ?? ''
    const parts = line.split(/\s+/)
    const totalBytes = Number(parts[1])
    const usedBytes = Number(parts[2])
    const freeBytes = Number(parts[3])
    if (!Number.isFinite(totalBytes) || !Number.isFinite(usedBytes) || !Number.isFinite(freeBytes)) {
        throw new AppError('Não foi possível interpretar a saída do "df"', 502)
    }
    return { totalBytes, usedBytes, freeBytes, usedPct: totalBytes > 0 ? usedBytes / totalBytes : 0 }
}

async function getDiskUsage() {
    const env = validateEnv()
    // DIALPLAN_EXTRA_DIR (/etc/asterisk/dialplan-extra por padrão) é um bind mount real do host -
    // reflete o disco de verdade da VPS, não o overlay filesystem do container (ver docker-compose.yml)
    const output = await runCommand(['df', '-B1', env.DIALPLAN_EXTRA_DIR], 5000)
    return parseDfOutput(output)
}

// Cacheado em memória do próprio processo (não Redis/CacheManager) - é uma métrica aproximada
// cara de calcular (du recursivo), não precisa de consistência entre réplicas web; cada uma
// computa a sua e reusa por alguns minutos, evitando um du completo a cada poll do dashboard.
async function getRecordingsSize(): Promise<number> {
    if (recordingsSizeCache && Date.now() - recordingsSizeCache.at < RECORDINGS_CACHE_MS) {
        return recordingsSizeCache.bytes
    }
    const output = await runCommand(['du', '-sb', RECORDINGS_DIR], 30_000)
    const bytes = Number(output.split(/\s+/)[0])
    if (!Number.isFinite(bytes)) throw new AppError('Não foi possível interpretar a saída do "du"', 502)
    recordingsSizeCache = { bytes, at: Date.now() }
    return bytes
}

// Mesmo padrão de getRecordingsSize (du recursivo caro, cacheado em memória do processo por
// 5min - métrica aproximada, sem necessidade de consistência entre réplicas web)
async function getLogsSize(): Promise<number> {
    if (logsSizeCache && Date.now() - logsSizeCache.at < LOGS_CACHE_MS) {
        return logsSizeCache.bytes
    }
    const output = await runCommand(['du', '-sb', LOGS_DIR], 30_000)
    const bytes = Number(output.split(/\s+/)[0])
    if (!Number.isFinite(bytes)) throw new AppError('Não foi possível interpretar a saída do "du"', 502)
    logsSizeCache = { bytes, at: Date.now() }
    return bytes
}

// os.cpus().times é cumulativo desde o boot, não dá % direto - amostra 2 leituras com um
// intervalo curto e tira a fração de tempo ocioso do delta, por núcleo (mesma técnica do "top"/
// "mpstat"). Janela de 1s (não 200ms) - o contador do SO só incrementa em ticks de ~10ms, então
// uma janela curta demais gera poucos ticks de resolução e o delta fica ruidoso (lia 0% mesmo com
// carga real). 1s é imperceptível num endpoint admin-only polado a cada 30s (useDashboardInfra).
function cpuTimesSnapshot() {
    return os.cpus().map((c) => ({
        idle: c.times.idle,
        total: c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq,
    }))
}

async function getPerCoreUsage(sampleMs = 1000): Promise<number[]> {
    const start = cpuTimesSnapshot()
    await new Promise((resolve) => setTimeout(resolve, sampleMs))
    const end = cpuTimesSnapshot()
    return start.map((s, i) => {
        const idleDelta = end[i]!.idle - s.idle
        const totalDelta = end[i]!.total - s.total
        if (totalDelta <= 0) return 0
        return Math.max(0, Math.min(1, 1 - idleDelta / totalDelta))
    })
}

// Contadores acumulados por interface desde o boot (coluna 1 = bytes recebidos, coluna 9 = bytes
// transmitidos - layout fixo do /proc/net/dev do kernel Linux). Soma todas as interfaces exceto
// "lo" (loopback não é tráfego real de rede). Container em bridge (produção Dokploy, ver CLAUDE.md)
// só enxerga o próprio veth, não a VPS inteira - mesma limitação já aceita pra CPU/memória (visão
// do processo/cgroup, não "toda a VPS" quando não está em network_mode: host).
async function readNetDevBytes(): Promise<{ rxBytes: number; txBytes: number }> {
    const output = await Bun.file('/proc/net/dev').text()
    let rxBytes = 0
    let txBytes = 0
    for (const line of output.trim().split('\n').slice(2)) {
        const [ifaceRaw, rest] = line.split(':')
        const iface = ifaceRaw?.trim()
        if (!iface || iface === 'lo' || !rest) continue
        const parts = rest.trim().split(/\s+/)
        rxBytes += Number(parts[0]) || 0
        txBytes += Number(parts[8]) || 0
    }
    return { rxBytes, txBytes }
}

// SwapTotal/SwapFree em kB, layout fixo do /proc/meminfo do kernel Linux (mesma fonte usada em
// readNetDevBytes pra /proc/net/dev). Sem swap configurado (comum em VPS), totalKb é 0 - usedPct
// cai pra 0 em vez de NaN.
async function getSwapUsage(): Promise<{ totalBytes: number; freeBytes: number; usedPct: number }> {
    const output = await Bun.file('/proc/meminfo').text()
    const totalKb = Number(output.match(/^SwapTotal:\s+(\d+)/m)?.[1] ?? 0)
    const freeKb = Number(output.match(/^SwapFree:\s+(\d+)/m)?.[1] ?? 0)
    const totalBytes = totalKb * 1024
    const freeBytes = freeKb * 1024
    return { totalBytes, freeBytes, usedPct: totalBytes > 0 ? (totalBytes - freeBytes) / totalBytes : 0 }
}

// Top processos por %CPU (ps já ordena, só recorta os N primeiros). %CPU do ps pode passar de
// 100% em host multi-core (ex: 350% usando 3.5 núcleos) - mantém o valor bruto sem normalizar
// pelo nº de núcleos, mesmo critério de "visão do processo/container" já aceito pra rede/CPU.
// Dado suplementar (não crítico como CPU/memória/disco) - qualquer falha no "ps" (binário
// ausente, saída inesperada) cai pra lista vazia em vez de quebrar o endpoint inteiro com 500.
async function getTopProcesses(limit = 5): Promise<{ pid: number; name: string; cpuPct: number; memPct: number }[]> {
    try {
        const output = await runCommand(['ps', '-eo', 'pid,%cpu,%mem,comm', '--no-headers', '--sort=-%cpu'], 5000)
        return output
            .trim()
            .split('\n')
            .slice(0, limit)
            .map((line) => {
                const parts = line.trim().split(/\s+/)
                return {
                    pid: Number(parts[0]),
                    cpuPct: Number(parts[1]) / 100,
                    memPct: Number(parts[2]) / 100,
                    name: parts.slice(3).join(' '),
                }
            })
            .filter((p) => Number.isFinite(p.pid) && Number.isFinite(p.cpuPct) && Number.isFinite(p.memPct))
    } catch {
        return []
    }
}

// Mesma técnica de getPerCoreUsage (2 amostras, janela de 1s) - contador cumulativo não dá
// bytes/s direto, precisa do delta entre 2 leituras.
async function getNetworkThroughput(sampleMs = 1000): Promise<{ rxBytesPerSec: number; txBytesPerSec: number }> {
    const start = await readNetDevBytes()
    await new Promise((resolve) => setTimeout(resolve, sampleMs))
    const end = await readNetDevBytes()
    const seconds = sampleMs / 1000
    return {
        rxBytesPerSec: Math.max(0, (end.rxBytes - start.rxBytes) / seconds),
        txBytesPerSec: Math.max(0, (end.txBytes - start.txBytes) / seconds),
    }
}

export const getDashboardInfra = async () => {
    const [disk, recordingsSizeBytes, logsSizeBytes, perCoreUsedPct, network, swap, topProcesses] = await Promise.all([
        getDiskUsage(),
        getRecordingsSize(),
        getLogsSize(),
        getPerCoreUsage(),
        getNetworkThroughput(),
        getSwapUsage(),
        getTopProcesses(),
    ])
    const totalBytes = os.totalmem()
    const freeBytes = os.freemem()
    const loadAvg = os.loadavg()

    return {
        uptimeSeconds: os.uptime(),
        network,
        cpu: {
            loadAvg1: loadAvg[0], loadAvg5: loadAvg[1], loadAvg15: loadAvg[2],
            cores: os.cpus().length,
            perCoreUsedPct,
        },
        memory: { totalBytes, freeBytes, usedPct: (totalBytes - freeBytes) / totalBytes },
        swap,
        disk,
        recordings: { sizeBytes: recordingsSizeBytes },
        logs: { sizeBytes: logsSizeBytes },
        topProcesses,
    }
}
