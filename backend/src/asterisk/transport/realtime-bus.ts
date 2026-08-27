import { EventEmitter } from 'node:events'

export type RealtimeChangeKind = 'extension' | 'trunk' | 'queue'

// Backend não escala horizontalmente (docker-compose.yml: 1 service, network_mode host) - ami-events.ts
// e as rotas SSE de realtime.routes.ts rodam no mesmo processo, então um EventEmitter in-process
// dispensa Redis pub/sub (que exigiria uma segunda conexão dedicada a subscriber).
export const realtimeBus = new EventEmitter()
realtimeBus.setMaxListeners(0) // 1 listener por conexão SSE aberta, N simultâneas é normal

export function emitRealtimeChange(kind: RealtimeChangeKind): void {
    realtimeBus.emit('change', kind)
}
