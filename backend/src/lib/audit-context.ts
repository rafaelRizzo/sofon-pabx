import { AsyncLocalStorage } from 'node:async_hooks'

export type AuditActor = {
    userId: string | null
    userName: string | null
    ip: string | null
}

const storage = new AsyncLocalStorage<AuditActor>()

// enterWith (não run): precisa sobreviver a todo o resto do lifecycle da request (onRequest ->
// preHandler -> handler -> service), que roda em hooks/callbacks separados do Fastify, não dentro
// de um único callback que dê pra envolver com storage.run(...)
export const auditContext = {
    init: (ip: string | null) => storage.enterWith({ userId: null, userName: null, ip }),
    setActor: (userId: string) => {
        const store = storage.getStore()
        if (store) store.userId = userId
    },
    get: (): AuditActor | undefined => storage.getStore(),
}
