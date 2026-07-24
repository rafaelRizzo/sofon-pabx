import { validateEnv } from '../config/env'
import { redisClient } from '../config/redis'
import { logger } from '../utils/logger'
import { parseMemberInterface } from './queue.repository'
import { extractAmiBlocks, type AmiBlock } from './ami-events.parser'
import { emitRealtimeChange } from './realtime-bus'
import { recordJoin, recordAgentConnect, recordAnswered, recordAbandoned } from '../modules/queue-calls/queue-calls.service'
import {
    STATUS_TTL_SECONDS, CALL_TTL_SECONDS, HOLDTIME_TTL_SECONDS,
    extKey, extCallsKey, callKey, trunkKey, queueMembersKey, queueWaitingKey, bridgeMembersKey, queueHoldtimeKey,
} from './realtime-keys'

// Conexão AMI PERSISTENTE com eventos (Events: on) — popula o cache de estado ao vivo em Redis
// (ramal/tronco online-offline, em chamada, filas). Independente do ami-client.ts existente
// (fire-and-forget, usado só pra "dialplan reload") — nunca deve derrubar o processo.

const CRLF = '\r\n'
const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000]
// Registro outbound (PJSIP) não dispara evento de mudança em tempo real no Asterisk — só dá pra
// saber o status atual reconsultando a action periodicamente
const REGISTRATIONS_POLL_MS = 30_000
// Endpoint PJSIP sem qualify_frequency configurado no AOR nunca dispara ContactStatus ao vivo —
// sem isso presence ficava travada no valor do snapshot do connect pra sempre
const ENDPOINTS_POLL_MS = 30_000
// Reconcilia contra o Asterisk quais canais estão de fato ativos — fecha o gap de Hangup perdido
// (reconexão do AMI, exceção engolida no handler) que deixaria uma chamada fantasma presa no card
const CHANNELS_POLL_MS = 30_000
// queue_members é escrito direto via Prisma (AsteriskQueueRepository), sem passar por nenhuma
// action AMI — um membro adicionado/removido depois que este processo já conectou nunca dispara
// QueueMemberAdded/Removed sozinho, então sem repoll ele ficava "unknown" pra sempre no card até o
// próximo restart do backend (que refaz o QueueStatus no login)
const QUEUE_STATUS_POLL_MS = 30_000

type Presence = 'online' | 'offline' | 'unknown'
type CallState = 'idle' | 'ringing' | 'in_call' | 'busy' | 'unavailable' | 'unknown'
type SnapshotKind = 'sippeers' | 'pjsip-endpoints' | 'queue-status' | 'pjsip-registrations' | 'core-channels'
type PendingSnapshot = { kind: SnapshotKind; items: AmiBlock[] }

let socket: Bun.Socket<undefined> | undefined
let buffer = ''
let loggedIn = false
let connecting = false
let shuttingDown = false
let backoffIdx = 0
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let registrationsPollTimer: ReturnType<typeof setInterval> | undefined
let endpointsPollTimer: ReturnType<typeof setInterval> | undefined
let channelsPollTimer: ReturnType<typeof setInterval> | undefined
let queueStatusPollTimer: ReturnType<typeof setInterval> | undefined
let actionCounter = 0
let amiDebugEnabled = false
const pendingSnapshots = new Map<string, PendingSnapshot>()

// Trunks usam astId `${asteriskId}-trunk-${name}` (ver trunks.service.ts); alias de ramal é só
// dígitos (validação de extension.schema.ts), então nunca colide com essa substring
export function isTrunkId(id: string): boolean {
    return id.includes('-trunk-')
}

// "SIP/2002_ast1" / "PJSIP/2002_ast1" -> "2002_ast1"; sem separador (EndpointName do pjsip já vem cru) -> idempotente
export function extensionNumberFrom(raw: string): string {
    const parsed = parseMemberInterface(raw)
    return parsed ? parsed.number : raw
}

// Nome de canal ("PJSIP/2002_ast1-00000012") tem sufixo de sequência que MEMBERINTERFACE não tem — precisa stripar
export function extensionNumberFromChannel(channel: string): string | null {
    const idx = channel.indexOf('/')
    if (idx === -1) return null
    const rest = channel.slice(idx + 1)
    const dashIdx = rest.lastIndexOf('-')
    return dashIdx === -1 ? rest : rest.slice(0, dashIdx)
}

export function mapPeerPresence(raw: string | undefined): Presence {
    const v = (raw ?? '').toUpperCase()
    if (v.includes('UNREGISTERED') || v.includes('UNREACHABLE') || v.includes('REMOVED')) return 'offline'
    if (v.includes('REGISTERED') || v.includes('REACHABLE') || v.includes('AVAIL') || v.startsWith('OK')) return 'online'
    return 'unknown'
}

// Cobre tanto o State de DeviceStateChange ("NOT_INUSE") quanto o DeviceState textual de
// PJSIPShowEndpoints ("Not in use") — substring match em vez de igualdade exata pra não depender
// de formatação exata por versão do Asterisk. Ordem importa: checar NOT_INUSE antes de INUSE, e
// RINGINUSE antes de RINGING.
export function mapDeviceState(raw: string | undefined): CallState {
    const v = (raw ?? '').toUpperCase()
    if (v.includes('NOT_INUSE') || v.includes('NOT IN USE') || v.includes('NOT_IN_USE')) return 'idle'
    if (v.includes('RINGINUSE')) return 'in_call'
    if (v.includes('RINGING')) return 'ringing'
    if (v.includes('ONHOLD') || v.includes('ON HOLD') || v.includes('ON_HOLD')) return 'in_call'
    if (v.includes('INUSE') || v.includes('IN USE') || v.includes('IN_USE')) return 'in_call'
    if (v.includes('BUSY')) return 'busy'
    if (v.includes('UNAVAILABLE') || v.includes('INVALID')) return 'unavailable'
    return 'unknown'
}

// QueueMember/QueueMemberStatus.Status vem como código numérico de device state do Asterisk
// (AST_DEVICE_*), não texto — confirmado via AMI_DEBUG contra Asterisk real (Status: "5" =
// Unavailable). Mesmo enum CallState dos ramais, pra reaproveitar o CallStateBadge no front.
const QUEUE_MEMBER_STATUS_MAP: Record<string, CallState> = {
    '0': 'unknown',
    '1': 'idle',
    '2': 'in_call',
    '3': 'busy',
    '4': 'unavailable',
    '5': 'unavailable',
    '6': 'ringing',
    '7': 'in_call',
    '8': 'in_call',
}

export function mapQueueMemberStatus(raw: string | undefined): CallState {
    return QUEUE_MEMBER_STATUS_MAP[raw ?? ''] ?? 'unknown'
}

async function writePresence(id: string, presence: Presence, extra?: Record<string, string>) {
    const trunk = isTrunkId(id)
    const key = trunk ? trunkKey(id) : extKey(id)
    await redisClient.hSet(key, { presence, updatedAt: String(Date.now()), ...extra })
    await redisClient.expire(key, STATUS_TTL_SECONDS)
    emitRealtimeChange(trunk ? 'trunk' : 'extension')
}

async function handlePeerStatus(block: AmiBlock) {
    if (!block.Peer) return
    await writePresence(extensionNumberFrom(block.Peer), mapPeerPresence(block.PeerStatus))
}

async function handleContactStatus(block: AmiBlock) {
    if (!block.EndpointName) return
    await writePresence(block.EndpointName, mapPeerPresence(block.ContactStatus))
}

async function handleDeviceState(block: AmiBlock) {
    if (!block.Device) return
    const id = extensionNumberFrom(block.Device)
    if (isTrunkId(id)) return
    await redisClient.hSet(extKey(id), { callState: mapDeviceState(block.State), updatedAt: String(Date.now()) })
    await redisClient.expire(extKey(id), STATUS_TTL_SECONDS)
    emitRealtimeChange('extension')
}

async function handleNewchannel(block: AmiBlock) {
    if (!block.Uniqueid || !block.Channel) return
    await redisClient.hSet(callKey(block.Uniqueid), {
        channel: block.Channel,
        callerNum: block.CallerIDNum ?? '',
        exten: block.Exten ?? '',
        startAt: String(Date.now()),
    })
    await redisClient.expire(callKey(block.Uniqueid), CALL_TTL_SECONDS)

    const number = extensionNumberFromChannel(block.Channel)
    if (number && !isTrunkId(number)) {
        await redisClient.sAdd(extCallsKey(number), block.Uniqueid)
        emitRealtimeChange('extension')
    }
}

// Dial(Begin) liga as duas pernas ANTES do bridge existir (BridgeEnter só roda depois que atende)
// — Channel/CallerIDNum aqui são de quem está DISCANDO (quase sempre o canal do tronco que trouxe
// a ligação), mais confiável que o CallerIDNum do próprio Newchannel da perna do ramal (que em
// alguns fluxos reflete o identificador do próprio ramal, não de quem chama). Permite mostrar
// tronco/número de quem liga já tocando, não só depois de atendido.
async function handleDialBegin(block: AmiBlock) {
    if (!block.DestUniqueid || !block.DestChannel) return
    const destNumber = extensionNumberFromChannel(block.DestChannel)
    if (!destNumber || isTrunkId(destNumber)) return

    const update: Record<string, string> = { peerChannel: block.Channel ?? '' }
    if (block.CallerIDNum) update.callerNum = block.CallerIDNum
    await redisClient.hSet(callKey(block.DestUniqueid), update)
    await redisClient.expire(callKey(block.DestUniqueid), CALL_TTL_SECONDS)
    emitRealtimeChange('extension')
}

async function handleHangup(block: AmiBlock) {
    if (!block.Uniqueid) return
    const number = block.Channel ? extensionNumberFromChannel(block.Channel) : null
    if (number && !isTrunkId(number)) await redisClient.sRem(extCallsKey(number), block.Uniqueid)
    await redisClient.del(callKey(block.Uniqueid))
    emitRealtimeChange('extension')
}

// "Quem fala com quem" rastreado só par a par via bridge — sem tentar reconstruir topologia N-way
// (conferência); suficiente pro escopo "em chamada: sim/não" + par simples (ver plano)
async function handleBridgeEnter(block: AmiBlock) {
    if (!block.BridgeUniqueid || !block.Uniqueid) return
    const key = bridgeMembersKey(block.BridgeUniqueid)
    await redisClient.sAdd(key, block.Uniqueid)
    await redisClient.expire(key, CALL_TTL_SECONDS)

    const members = await redisClient.sMembers(key)
    if (members.length === 2) {
        const [a, b] = members as [string, string]
        await redisClient.hSet(callKey(a), { bridgedWith: b })
        await redisClient.hSet(callKey(b), { bridgedWith: a })
    }
    emitRealtimeChange('extension')
}

async function handleBridgeLeave(block: AmiBlock) {
    if (!block.BridgeUniqueid || !block.Uniqueid) return
    await redisClient.sRem(bridgeMembersKey(block.BridgeUniqueid), block.Uniqueid)
    await redisClient.hDel(callKey(block.Uniqueid), 'bridgedWith')
    emitRealtimeChange('extension')
}

async function patchQueueMember(queueName: string, iface: string, patch: Record<string, unknown>) {
    const membersKey = queueMembersKey(queueName)
    const raw = await redisClient.hGet(membersKey, iface)
    const current = raw ? JSON.parse(raw) : { paused: false, pauseReason: '', status: 'unknown', penalty: 0 }
    await redisClient.hSet(membersKey, { [iface]: JSON.stringify({ ...current, ...patch }) })
    await redisClient.expire(membersKey, STATUS_TTL_SECONDS)
    emitRealtimeChange('queue')
}

// QueueMemberStatus/Pause/Added/Removed (eventos "ao vivo" de mudança) mandam a interface do
// membro em `Interface`, não `Location` — confirmado via AMI_DEBUG contra Asterisk 22.7 real.
// `Location` é só do sub-evento QueueMember dentro da resposta da action QueueStatus (snapshot
// cold-start/poll periódico, ver writeQueueSnapshot). Sem esse fallback, todo evento ao vivo de
// membro batia no guard `!interface` e voltava silenciosamente, deixando o status sempre "unknown".
export function memberInterfaceOf(block: AmiBlock): string | undefined {
    return block.Interface || block.Location
}

async function handleQueueMemberStatus(block: AmiBlock) {
    const iface = memberInterfaceOf(block)
    if (!block.Queue || !iface) return
    await patchQueueMember(block.Queue, iface, { status: mapQueueMemberStatus(block.Status) })
}

async function handleQueueMemberPause(block: AmiBlock) {
    const iface = memberInterfaceOf(block)
    if (!block.Queue || !iface) return
    await patchQueueMember(block.Queue, iface, {
        paused: block.Paused === '1',
        pauseReason: block.Reason ?? block.PausedReason ?? '',
    })
}

async function handleQueueMemberAdded(block: AmiBlock) {
    const iface = memberInterfaceOf(block)
    if (!block.Queue || !iface) return
    await patchQueueMember(block.Queue, iface, {
        status: mapQueueMemberStatus(block.Status),
        paused: block.Paused === '1',
        penalty: Number(block.Penalty ?? 0),
    })
}

async function handleQueueMemberRemoved(block: AmiBlock) {
    const iface = memberInterfaceOf(block)
    if (!block.Queue || !iface) return
    await redisClient.hDel(queueMembersKey(block.Queue), iface)
    emitRealtimeChange('queue')
}

async function handleQueueCallerJoin(block: AmiBlock) {
    if (!block.Queue || !block.Uniqueid) return
    await redisClient.zAdd(queueWaitingKey(block.Queue), { score: Date.now(), value: block.Uniqueid })
    emitRealtimeChange('queue')

    const position = block.Position ? Number(block.Position) : null
    await recordJoin({
        queueName: block.Queue,
        callerUniqueid: block.Uniqueid,
        linkedid: block.Linkedid,
        src: block.CallerIDNum,
        position: position != null && Number.isFinite(position) ? position : null,
    })
}

// Fila responde quando o cliente desliga esperando (sem ter sido conectado a nenhum agente) —
// único caso em que não há AGI queue-outcome subsequente (o canal do ligante morre, Queue()
// nunca retorna pra próxima priority nesse fluxo)
async function handleQueueCallerAbandon(block: AmiBlock) {
    if (!block.Queue || !block.Uniqueid) return
    const holdTime = block.HoldTime ? Number(block.HoldTime) : null
    const position = block.Position ? Number(block.Position) : null
    await recordAbandoned({
        queueName: block.Queue,
        callerUniqueid: block.Uniqueid,
        holdTimeSeconds: holdTime != null && Number.isFinite(holdTime) ? holdTime : null,
        position: position != null && Number.isFinite(position) ? position : null,
    })
}

// Dispara quando o bridge com um agente é estabelecido de fato — Uniqueid aqui é o do LIGANTE
// (mesmo vocabulário de QueueCallerJoin), Interface é quem atendeu
async function handleAgentConnect(block: AmiBlock) {
    if (!block.Queue || !block.Uniqueid || !block.Interface) return
    const holdTime = block.HoldTime ? Number(block.HoldTime) : null
    await recordAgentConnect({
        queueName: block.Queue,
        callerUniqueid: block.Uniqueid,
        agentInterface: block.Interface,
        holdTimeSeconds: holdTime != null && Number.isFinite(holdTime) ? holdTime : null,
    })
}

// Dispara quando a chamada JÁ CONECTADA a um agente termina, independente de quem desligou
// primeiro (Reason: "caller"|"agent") — cobre o caso em que o ligante desliga durante o
// atendimento, quando o Queue() também nunca retorna pra próxima priority
async function handleAgentComplete(block: AmiBlock) {
    if (!block.Queue || !block.Uniqueid) return
    const talkTime = block.TalkTime ? Number(block.TalkTime) : null
    await recordAnswered({
        queueName: block.Queue,
        callerUniqueid: block.Uniqueid,
        talkTimeSeconds: talkTime != null && Number.isFinite(talkTime) ? talkTime : null,
        reason: block.Reason,
    })
}

// Data local (fuso do env.TZ) usada como partição diária do agregado de holdtime (ver
// getQueueHoldtimeToday em realtime.service.ts) — não dá pra usar CDR pra essa métrica: Queue()
// atende o canal do ligante já na entrada da fila (pra tocar MOH), então answer≈start no CDR e
// duration-billsec fica sempre ~0, não reflete o tempo até o agente atender de verdade.
function todayKey(): string {
    const env = validateEnv()
    return new Intl.DateTimeFormat('en-CA', { timeZone: env.TZ }).format(new Date())
}

// QueueCallerLeave fecha o par de QueueCallerJoin (join foi quem gravou o score = timestamp de
// entrada em queueWaitingKey) — a diferença é exatamente quanto tempo esse ligante ficou
// esperando, dá igual se saiu por ter sido atendido ou por ter desistido.
async function handleQueueCallerLeave(block: AmiBlock) {
    if (!block.Queue || !block.Uniqueid) return
    const joinedAt = await redisClient.zScore(queueWaitingKey(block.Queue), block.Uniqueid)
    await redisClient.zRem(queueWaitingKey(block.Queue), block.Uniqueid)
    if (joinedAt != null) {
        const waitSeconds = Math.max(0, (Date.now() - joinedAt) / 1000)
        const holdtimeKey = queueHoldtimeKey(block.Queue, todayKey())
        await redisClient.hIncrByFloat(holdtimeKey, 'sum', waitSeconds)
        await redisClient.hIncrBy(holdtimeKey, 'count', 1)
        await redisClient.expire(holdtimeKey, HOLDTIME_TTL_SECONDS)
    }
    emitRealtimeChange('queue')
}

// Qualquer evento fora desta lista é ignorado de propósito — não modelar every single Asterisk event
async function routeEvent(block: AmiBlock): Promise<void> {
    switch (block.Event) {
        case 'PeerStatus': return handlePeerStatus(block)
        case 'ContactStatusDetail':
        case 'ContactStatus': return handleContactStatus(block)
        case 'DeviceStateChange': return handleDeviceState(block)
        case 'Newchannel': return handleNewchannel(block)
        case 'DialBegin': return handleDialBegin(block)
        case 'Hangup': return handleHangup(block)
        case 'BridgeEnter': return handleBridgeEnter(block)
        case 'BridgeLeave': return handleBridgeLeave(block)
        case 'QueueMemberStatus': return handleQueueMemberStatus(block)
        case 'QueueMemberPause': return handleQueueMemberPause(block)
        case 'QueueMemberAdded': return handleQueueMemberAdded(block)
        case 'QueueMemberRemoved': return handleQueueMemberRemoved(block)
        case 'QueueCallerJoin': return handleQueueCallerJoin(block)
        case 'QueueCallerLeave': return handleQueueCallerLeave(block)
        case 'QueueCallerAbandon': return handleQueueCallerAbandon(block)
        case 'AgentConnect': return handleAgentConnect(block)
        case 'AgentComplete': return handleAgentComplete(block)
        default: return
    }
}

// --- Snapshot inicial (cold start / reconnect) ---------------------------------------------

function nextActionId(prefix: string): string {
    actionCounter += 1
    return `${prefix}-${actionCounter}`
}

function requestSnapshotKind(kind: SnapshotKind, action: string) {
    const actionId = nextActionId(`snap-${kind}`)
    pendingSnapshots.set(actionId, { kind, items: [] })
    socket?.write(`Action: ${action}${CRLF}ActionID: ${actionId}${CRLF}${CRLF}`)
}

function requestSnapshot() {
    requestSnapshotKind('sippeers', 'SIPpeers')
    requestSnapshotKind('pjsip-endpoints', 'PJSIPShowEndpoints')
    requestSnapshotKind('queue-status', 'QueueStatus')
    requestSnapshotKind('pjsip-registrations', 'PJSIPShowRegistrationsOutbound')
    requestSnapshotKind('core-channels', 'CoreShowChannels')

    // Repolling pra registro outbound (sem evento de mudança nativo), presence de endpoint sem
    // qualify (idem) e reconciliação de canais ativos (fecha gap de Hangup perdido) — iniciados
    // uma única vez, sobrevivem a reconexões (guard por loggedIn evita escrever num socket morto)
    if (!registrationsPollTimer) {
        registrationsPollTimer = setInterval(() => {
            if (loggedIn) requestSnapshotKind('pjsip-registrations', 'PJSIPShowRegistrationsOutbound')
        }, REGISTRATIONS_POLL_MS)
    }
    if (!endpointsPollTimer) {
        endpointsPollTimer = setInterval(() => {
            if (loggedIn) requestSnapshotKind('pjsip-endpoints', 'PJSIPShowEndpoints')
        }, ENDPOINTS_POLL_MS)
    }
    if (!channelsPollTimer) {
        channelsPollTimer = setInterval(() => {
            if (loggedIn) requestSnapshotKind('core-channels', 'CoreShowChannels')
        }, CHANNELS_POLL_MS)
    }
    if (!queueStatusPollTimer) {
        queueStatusPollTimer = setInterval(() => {
            if (loggedIn) requestSnapshotKind('queue-status', 'QueueStatus')
        }, QUEUE_STATUS_POLL_MS)
    }
}

async function hydrateSipPeers(items: AmiBlock[]) {
    for (const item of items) {
        if (item.Event !== 'PeerEntry' || !item.ObjectName) continue
        await writePresence(item.ObjectName, mapPeerPresence(item.Status))
    }
}

// DeviceState do PJSIP já reflete disponibilidade de contato (endpoint sem registro = Unavailable),
// então dá pra derivar presence do mesmo campo sem uma segunda ação por endpoint
async function hydratePjsipEndpoints(items: AmiBlock[]) {
    let changed = false
    for (const item of items) {
        if (item.Event !== 'EndpointList' || !item.ObjectName || isTrunkId(item.ObjectName) || !item.DeviceState) continue
        const callState = mapDeviceState(item.DeviceState)
        await redisClient.hSet(extKey(item.ObjectName), {
            callState,
            presence: callState === 'unavailable' ? 'offline' : 'online',
            updatedAt: String(Date.now()),
        })
        await redisClient.expire(extKey(item.ObjectName), STATUS_TTL_SECONDS)
        changed = true
    }
    // 1 emit pro snapshot inteiro, não por endpoint — hydrate roda a cada 30s (ENDPOINTS_POLL_MS)
    // e pode ter dezenas de itens, coalescer aqui evita disparar o mesmo tanto de emits à toa
    if (changed) emitRealtimeChange('extension')
}

async function writeQueueSnapshot(queueName: string, entry: { members: AmiBlock[]; callers: AmiBlock[] }) {
    const membersKey = queueMembersKey(queueName)
    await redisClient.del(membersKey)
    for (const m of entry.members) {
        const iface = memberInterfaceOf(m)
        if (!iface) continue
        await redisClient.hSet(membersKey, {
            [iface]: JSON.stringify({
                paused: m.Paused === '1',
                pauseReason: m.PausedReason ?? '',
                status: mapQueueMemberStatus(m.Status),
                penalty: Number(m.Penalty ?? 0),
            }),
        })
    }
    if (entry.members.length > 0) await redisClient.expire(membersKey, STATUS_TTL_SECONDS)

    const waitingKey = queueWaitingKey(queueName)
    await redisClient.del(waitingKey)
    for (const c of entry.callers) {
        if (!c.Uniqueid) continue
        // QueueEntry.Wait é quanto tempo esse ligante JÁ esperou (segundos) — usa isso pra
        // reconstruir o timestamp real de entrada em vez de carimbar Date.now() aqui. Sem isso,
        // todo poll periódico (30s) reseta o relógio de quem já está esperando há mais tempo,
        // subestimando tanto o "há Xs" do Aguardando quanto o holdtime calculado no Leave.
        const waitedMs = c.Wait ? Number(c.Wait) * 1000 : 0
        await redisClient.zAdd(waitingKey, { score: Date.now() - waitedMs, value: c.Uniqueid })
    }
}

async function hydrateQueueStatus(items: AmiBlock[]) {
    // QueueParams (Calls/Holdtime) não é mais gravado — `calls` da API agora vem ao vivo do
    // tamanho de queueWaitingKey (ver getQueuesStatus em realtime.service.ts), não desse
    // snapshot periódico; e `holdtime` vem do agregado join/leave (queueHoldtimeKey, ver
    // handleQueueCallerLeave acima). O evento só serve aqui pra garantir que a fila apareça em
    // byQueue mesmo sem member/caller (zera o resíduo).
    const byQueue = new Map<string, { members: AmiBlock[]; callers: AmiBlock[] }>()
    for (const item of items) {
        if (!item.Queue) continue
        const entry = byQueue.get(item.Queue) ?? { members: [], callers: [] }
        if (item.Event === 'QueueMember') entry.members.push(item)
        else if (item.Event === 'QueueEntry') entry.callers.push(item)
        byQueue.set(item.Queue, entry)
    }
    for (const [queueName, entry] of byQueue) await writeQueueSnapshot(queueName, entry)
    if (byQueue.size > 0) emitRealtimeChange('queue')
}

// ObjectName é o astId do tronco (mesmo id de PJSIPShowEndpoints pra trunks) — isTrunkId dentro de
// writePresence já roteia pra rt:trunk:<astId>. "Expiration" é o intervalo de registro configurado
// (segundos) — confirmado via AMI_DEBUG contra Asterisk real; não é uma contagem regressiva ao
// vivo (isso a CLI computa por conta própria, não vem exposto por essa action) nem RTT/ping.
async function hydratePjsipRegistrations(items: AmiBlock[]) {
    for (const item of items) {
        if (item.Event !== 'OutboundRegistrationDetail' || !item.ObjectName) continue
        const extra = item.Expiration ? { expirySeconds: item.Expiration } : undefined
        await writePresence(item.ObjectName, mapPeerPresence(item.Status), extra)
    }
}

// Ground truth do que está de fato ativo agora, contra o que o Redis acha que está em chamada —
// qualquer uniqueid marcado num rt:ext:calls:* que o Asterisk não listou mais é lixo (Hangup
// perdido: reconexão do AMI, exceção engolida no handler etc.) e ficaria preso até o TTL de 4h
// sem essa reconciliação. Também recria o hash da chamada se ela já estava em andamento quando
// este processo subiu (sem Newchannel correspondente capturado).
async function hydrateCoreChannels(items: AmiBlock[]) {
    const liveUniqueids = new Set<string>()
    let changed = false

    for (const item of items) {
        if (item.Event !== 'CoreShowChannel' || !item.Channel || !item.Uniqueid) continue
        liveUniqueids.add(item.Uniqueid)

        const number = extensionNumberFromChannel(item.Channel)
        if (!number || isTrunkId(number)) continue

        await redisClient.sAdd(extCallsKey(number), item.Uniqueid)
        const exists = await redisClient.exists(callKey(item.Uniqueid))
        if (!exists) {
            await redisClient.hSet(callKey(item.Uniqueid), {
                channel: item.Channel,
                callerNum: item.CallerIDNum ?? '',
                exten: item.Exten ?? '',
                startAt: String(Date.now()),
            })
            changed = true
        }
        await redisClient.expire(callKey(item.Uniqueid), CALL_TTL_SECONDS)
    }

    const trackedKeys = await redisClient.keys('rt:ext:calls:*')
    for (const key of trackedKeys) {
        const tracked = await redisClient.sMembers(key)
        const stale = tracked.filter((u) => !liveUniqueids.has(u))
        if (stale.length === 0) continue
        await redisClient.sRem(key, stale)
        for (const u of stale) await redisClient.del(callKey(u))
        changed = true
    }

    if (changed) emitRealtimeChange('extension')
}

async function hydrateSnapshot(kind: SnapshotKind, items: AmiBlock[]): Promise<void> {
    if (kind === 'sippeers') return hydrateSipPeers(items)
    if (kind === 'pjsip-endpoints') return hydratePjsipEndpoints(items)
    if (kind === 'pjsip-registrations') return hydratePjsipRegistrations(items)
    if (kind === 'core-channels') return hydrateCoreChannels(items)
    return hydrateQueueStatus(items)
}

// --- Conexão, roteamento e reconexão --------------------------------------------------------

function isSnapshotComplete(block: AmiBlock): boolean {
    return (block.Event ?? '').endsWith('Complete')
}

async function handleBlock(block: AmiBlock): Promise<void> {
    if (amiDebugEnabled) logger.warn({ event: 'ami.debug.message', message: block })

    if (!loggedIn) {
        if (block.Response === 'Success' && /accepted/i.test(block.Message ?? '')) {
            loggedIn = true
            backoffIdx = 0
            logger.info({ event: 'ami.events.logged_in' })
            requestSnapshot()
            return
        }
        if (block.Response === 'Error') {
            logger.warn({ event: 'ami.events.login.failed', message: block.Message })
            socket?.end()
        }
        return
    }

    const actionId = block.ActionID
    if (actionId) {
        const pending = pendingSnapshots.get(actionId)
        if (pending) {
            if (isSnapshotComplete(block)) {
                pendingSnapshots.delete(actionId)
                await hydrateSnapshot(pending.kind, pending.items)
            } else {
                pending.items.push(block)
            }
            return
        }
    }

    if (block.Event) await routeEvent(block)
}

function scheduleReconnect() {
    if (shuttingDown) return
    const delay = BACKOFF_STEPS_MS[Math.min(backoffIdx, BACKOFF_STEPS_MS.length - 1)]!
    backoffIdx += 1
    reconnectTimer = setTimeout(() => { void connect() }, delay)
}

async function connect(): Promise<void> {
    if (connecting || socket) return
    connecting = true
    const env = validateEnv()
    amiDebugEnabled = env.AMI_DEBUG
    buffer = ''
    loggedIn = false
    pendingSnapshots.clear()

    try {
        await Bun.connect({
            hostname: env.AMI_HOST,
            port: env.AMI_PORT,
            socket: {
                open(sock) {
                    socket = sock
                    connecting = false
                    sock.write(`Action: Login${CRLF}Username: ${env.AMI_USER}${CRLF}Secret: ${env.AMI_SECRET}${CRLF}Events: on${CRLF}${CRLF}`)
                },
                data(_sock, data) {
                    buffer += data.toString('utf8')
                    const { blocks, rest } = extractAmiBlocks(buffer)
                    buffer = rest
                    for (const block of blocks) {
                        handleBlock(block).catch((error) => {
                            logger.warn({ event: 'ami.events.handler.failed', message: error instanceof Error ? error.message : String(error) })
                        })
                    }
                },
                error(_sock, error) {
                    logger.warn({ event: 'ami.events.socket.error', message: error.message })
                },
                close() {
                    logger.warn({ event: 'ami.events.disconnected' })
                    socket = undefined
                    connecting = false
                    scheduleReconnect()
                },
                drain() {},
            },
        })
    } catch (error) {
        connecting = false
        logger.warn({ event: 'ami.events.connect.failed', message: error instanceof Error ? error.message : String(error) })
        scheduleReconnect()
    }
}

export function startAmiEvents(): void {
    const env = validateEnv()
    if (!env.AMI_SECRET) {
        logger.warn({ event: 'ami.events.skipped', reason: 'AMI_SECRET not configured' })
        return
    }
    shuttingDown = false
    void connect()
}

export async function stopAmiEvents(): Promise<void> {
    shuttingDown = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (registrationsPollTimer) clearInterval(registrationsPollTimer)
    if (endpointsPollTimer) clearInterval(endpointsPollTimer)
    if (channelsPollTimer) clearInterval(channelsPollTimer)
    if (queueStatusPollTimer) clearInterval(queueStatusPollTimer)
    socket?.end()
    socket = undefined
}
