import { mock } from 'bun:test'

function model() {
    return {
        findUnique: mock(),
        findUniqueOrThrow: mock(),
        findFirst: mock(),
        findMany: mock(() => Promise.resolve([])),
        create: mock(),
        createMany: mock(() => Promise.resolve({ count: 0 })),
        update: mock(),
        updateMany: mock(() => Promise.resolve({ count: 0 })),
        delete: mock(),
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
        upsert: mock(),
        count: mock(() => Promise.resolve(0)),
        groupBy: mock(() => Promise.resolve([])),
    }
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
        flowEdge: model(),
        flow: model(),
        flowNode: model(),
        flowNodeEdge: model(),
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
    }
    return db
}

export function clearPrismaMock(db: ReturnType<typeof createPrismaMock>) {
    for (const model of Object.values(db)) {
        if (model && typeof model === 'object') {
            for (const fn of Object.values(model as object)) {
                if (fn && typeof (fn as any).mockReset === 'function') {
                    ;(fn as any).mockReset()
                }
            }
        }
    }
    if (typeof (db.$transaction as any).mockReset === 'function') {
        db.$transaction.mockReset()
        db.$transaction.mockImplementation((fn: (tx: any) => any) => fn(db))
    }
}
