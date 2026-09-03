import { mock } from 'bun:test'

// Métodos de leitura/agregação em lote têm um resultado "vazio" óbvio - default aqui evita que
// todo teste precise mockar explicitamente um findMany que não é o foco do caso testado. mockReset
// (clearPrismaMock abaixo) apaga esse default junto com o resto, então ele precisa ser reaplicado
// a cada beforeEach - ver DEFAULT_IMPLS.
const DEFAULT_IMPLS: Record<string, () => Promise<unknown>> = {
    findMany: () => Promise.resolve([]),
    createMany: () => Promise.resolve({ count: 0 }),
    updateMany: () => Promise.resolve({ count: 0 }),
    deleteMany: () => Promise.resolve({ count: 0 }),
    count: () => Promise.resolve(0),
    groupBy: () => Promise.resolve([]),
    aggregate: () => Promise.resolve({}),
}

function model() {
    const m: Record<string, ReturnType<typeof mock>> = {
        findUnique: mock(),
        findUniqueOrThrow: mock(),
        findFirst: mock(),
        create: mock(),
        update: mock(),
        delete: mock(),
        upsert: mock(),
    }
    for (const [name, impl] of Object.entries(DEFAULT_IMPLS)) m[name] = mock(impl)
    return m
}

export function createPrismaMock() {
    const db: any = {
        user: model(),
        company: model(),
        userCompany: model(),
        did: model(),
        extension: model(),
        trunk: model(),
        queue: model(),
        queueMember: model(),
        outboundRoute: model(),
        outboundDialPattern: model(),
        outboundRouteTrunk: model(),
        outboundRouteExtension: model(),
        timeGroup: model(),
        timeRange: model(),
        timeCondition: model(),
        timeConditionTimeGroup: model(),
        holidayGroup: model(),
        holidayDate: model(),
        inboundRoute: model(),
        announcement: model(),
        ivrMenu: model(),
        ivrOption: model(),
        requestTemplate: model(),
        audio: model(),
        agentCompanyScope: model(),
        routingRule: model(),
        callRating: model(),
        agentAffinity: model(),
        variableSet: model(),
        variableCondition: model(),
        variable: model(),
        flowEdge: model(),
        flow: model(),
        flowNode: model(),
        flowNodeEdge: model(),
        queueCall: model(),
        auditLog: model(),
        integrationCredential: model(),
        ixcNode: model(),
        formatterNode: model(),
        callQuality: model(),
        // Asterisk realtime
        ps_endpoints: model(),
        ps_auths: model(),
        ps_aors: model(),
        ps_identifies: model(),
        ps_registrations: model(),
        sip_peers: model(),
        extensions: model(),
        queues: model(),
        queue_members: model(),
        cdr: model(),
        $transaction: mock((fn: (tx: any) => any) => fn(db)),
        $disconnect: mock(() => Promise.resolve()),
        $queryRaw: mock(() => Promise.resolve([])),
    }
    return db
}

export function clearPrismaMock(db: ReturnType<typeof createPrismaMock>) {
    for (const model of Object.values(db)) {
        if (model && typeof model === 'object') {
            for (const [name, fn] of Object.entries(model as Record<string, any>)) {
                if (fn && typeof fn.mockReset === 'function') {
                    fn.mockReset()
                    if (DEFAULT_IMPLS[name]) fn.mockImplementation(DEFAULT_IMPLS[name])
                }
            }
        }
    }
    if (typeof (db.$transaction as any).mockReset === 'function') {
        db.$transaction.mockReset()
        db.$transaction.mockImplementation((fn: (tx: any) => any) => fn(db))
    }
}
