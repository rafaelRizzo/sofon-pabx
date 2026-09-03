import os from 'node:os'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import { validateEnv } from '../../config/env'
import { getExtensionsStatus } from '../realtime/realtime.service'

const TZ = process.env.TZ || 'America/Sao_Paulo'

// Mesmo formato usado em todo o projeto pra filtrar CDR por dia (ver cdr.service.ts) - string
// solta YYYY-MM-DD no fuso da empresa, sem conversão: startTime é naive-local (ver schema.prisma)
function localDateParts(): { today: string; monthStart: string; yearStart: string } {
    const now = new Date()
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now) // YYYY-MM-DD
    const year = today.slice(0, 4)
    const month = today.slice(5, 7)
    return { today, monthStart: `${year}-${month}-01`, yearStart: `${year}-01-01` }
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
        return { extensionsOnline: 0, extensionsOffline: 0, callsToday: 0, callsThisMonth: 0, callsThisYear: 0 }
    }

    const [extensions, asteriskIds] = await Promise.all([
        getExtensionsStatus(companyIds),
        resolveAsteriskIds(companyIds),
    ])

    const extensionsOnline = extensions.filter((e) => e.presence === 'online').length
    const extensionsOffline = extensions.length - extensionsOnline

    const { today, monthStart, yearStart } = localDateParts()
    // asteriskIds vazio (empresas sem trunk cadastrado ainda não tem CDR) - filtro por lista vazia
    // do Prisma já retorna 0 corretamente, sem precisar de guarda extra
    const accountcode = { in: asteriskIds }

    const [callsToday, callsThisMonth, callsThisYear] = await Promise.all([
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${today}T00:00:00.000Z`) } } }),
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${monthStart}T00:00:00.000Z`) } } }),
        prisma.cdr.count({ where: { accountcode, startTime: { gte: new Date(`${yearStart}T00:00:00.000Z`) } } }),
    ])

    return { extensionsOnline, extensionsOffline, callsToday, callsThisMonth, callsThisYear }
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

export const getDashboardInfra = async () => {
    const [disk, recordingsSizeBytes, logsSizeBytes] = await Promise.all([
        getDiskUsage(),
        getRecordingsSize(),
        getLogsSize(),
    ])
    const totalBytes = os.totalmem()
    const freeBytes = os.freemem()
    const loadAvg = os.loadavg()

    return {
        cpu: { loadAvg1: loadAvg[0], loadAvg5: loadAvg[1], loadAvg15: loadAvg[2], cores: os.cpus().length },
        memory: { totalBytes, freeBytes, usedPct: (totalBytes - freeBytes) / totalBytes },
        disk,
        recordings: { sizeBytes: recordingsSizeBytes },
        logs: { sizeBytes: logsSizeBytes },
    }
}
