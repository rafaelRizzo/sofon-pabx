import { prisma } from '../../lib/prisma'
import { parseAsteriskQueueName } from '../../asterisk/queue.repository'
import { FLOW_NODE_CONTEXT } from '../../asterisk/dialplan-names'

// Reconhece as 2 formas de exten técnico cru que podem acabar em `dst` quando a chamada é
// roteada por um Flow: `node-<flowNodeId>` (hangup dentro do próprio node) e
// `exit-<flowNodeId>-<port>` (hangup numa porta de saída específica). `FLOW_NODE_CONTEXT` não é
// usado no match (o contexto não aparece em `dst`), só documenta a origem do formato.
void FLOW_NODE_CONTEXT
const NODE_EXTEN_RE = /^node-([0-9a-z]{24,})$/
const EXIT_EXTEN_RE = /^exit-([0-9a-z]{24,})-(.+)$/

type ParsedDst =
    | { kind: 'queue'; queueNumber: string }
    | { kind: 'flowNode'; flowNodeId: string; port: string | null }

// `queueName` (custom, setado via Set(CDR(queue_name)=...) antes do Queue() nativo) é a fonte
// preferida; cai pro parse de `dst` só quando o enriquecimento nativo não sobreviveu até o fim
// da chamada (ver comentário em cdr.service.ts sobre chamadas roteadas por Flow).
function parseTechnicalDst(dst: string | null, queueName: string | null): ParsedDst | null {
    const queueSource = queueName ?? dst
    const parsedQueue = queueSource && parseAsteriskQueueName(queueSource)
    if (parsedQueue) return { kind: 'queue', queueNumber: parsedQueue.queueNumber }

    if (!dst) return null
    const exitMatch = dst.match(EXIT_EXTEN_RE)
    if (exitMatch) return { kind: 'flowNode', flowNodeId: exitMatch[1]!, port: exitMatch[2]! }
    const nodeMatch = dst.match(NODE_EXTEN_RE)
    if (nodeMatch) return { kind: 'flowNode', flowNodeId: nodeMatch[1]!, port: null }
    return null
}

type EnrichableRecord = {
    dst: string | null
    queueName: string | null
    uniqueid: string | null
    originExtension: string | null
    src: string | null
}

export type CdrEnrichment = {
    queueLabel: string | null
    destinationLabel: string | null
    answeredBy: { extensionId: string; label: string } | null
    originLabel: string | null
    queueWaitSeconds: number | null
    queueTalkSeconds: number | null
}

// Enriquece em tempo de leitura, sem depender do dialplan ter sobrevivido até o fim da chamada:
// - queueLabel/destinationLabel resolvidos por padrão de string (fila ou node de Flow)
// - answeredBy via QueueCall (alimentado por eventos AMI, independente do CDR nativo) —
//   QueueCall.callerUniqueid é o mesmo Uniqueid do canal do chamador, igual a cdr.uniqueid
export async function enrichCdrRecords<T extends EnrichableRecord>(
    records: T[],
    company: { id: string }
): Promise<(T & CdrEnrichment)[]> {
    const parsedByIndex = records.map((r) => parseTechnicalDst(r.dst, r.queueName))

    const queueNumbers = new Set<string>()
    const flowNodeIds = new Set<string>()
    for (const parsed of parsedByIndex) {
        if (parsed?.kind === 'queue') queueNumbers.add(parsed.queueNumber)
        if (parsed?.kind === 'flowNode') flowNodeIds.add(parsed.flowNodeId)
    }
    const uniqueids = [...new Set(records.map((r) => r.uniqueid).filter((u): u is string => !!u))]
    // src entra no mesmo lookup de originExtension: quando a chamada cai no fallback `_X.`
    // (sem match no dialplan ramal-a-ramal), `CDR(origin_extension)` nunca é setado e o único
    // dado de origem disponível é o `src` nativo do Asterisk — que já é o mesmo CALLERID(num)
    // sufixado (`Extension.number`) usado em origin_extension, então bate no mesmo mapa
    const originNumbers = [
        ...new Set(
            records
                .flatMap((r) => [r.originExtension, r.src])
                .filter((n): n is string => !!n)
        )
    ]

    const [queues, flowNodes, queueCalls, originExtensions] = await Promise.all([
        queueNumbers.size
            ? prisma.queue.findMany({
                  where: { companyId: company.id, number: { in: [...queueNumbers] } },
                  select: { name: true, number: true }
              })
            : Promise.resolve([]),
        flowNodeIds.size
            ? prisma.flowNode.findMany({
                  where: { id: { in: [...flowNodeIds] }, flow: { companyId: company.id } },
                  select: { id: true, label: true, type: true, flow: { select: { name: true } } }
              })
            : Promise.resolve([]),
        uniqueids.length
            ? prisma.queueCall.findMany({
                  where: { companyId: company.id, callerUniqueid: { in: uniqueids } },
                  select: {
                      callerUniqueid: true,
                      agentExtensionId: true,
                      agentExtension: { select: { alias: true, name: true } },
                      waitSeconds: true,
                      talkSeconds: true
                  }
              })
            : Promise.resolve([]),
        originNumbers.length
            ? prisma.extension.findMany({
                  where: { companyId: company.id, number: { in: originNumbers } },
                  select: { number: true, alias: true, name: true }
              })
            : Promise.resolve([])
    ])

    const queueByNumber = new Map(queues.map((q) => [q.number, q]))
    const flowNodeById = new Map(flowNodes.map((n) => [n.id, n]))
    const agentByUniqueid = new Map(
        queueCalls
            .filter((qc) => qc.agentExtensionId && qc.agentExtension)
            .map((qc) => [
                qc.callerUniqueid,
                { extensionId: qc.agentExtensionId!, label: `${qc.agentExtension!.alias} - ${qc.agentExtension!.name}` }
            ])
    )
    const queueTimingByUniqueid = new Map(
        queueCalls.map((qc) => [qc.callerUniqueid, { waitSeconds: qc.waitSeconds, talkSeconds: qc.talkSeconds }])
    )
    const extensionByNumber = new Map(originExtensions.map((e) => [e.number, `${e.alias} - ${e.name}`]))

    return records.map((record, i) => {
        const parsed = parsedByIndex[i]
        let queueLabel: string | null = null
        let destinationLabel: string | null = null

        if (parsed?.kind === 'queue') {
            const q = queueByNumber.get(parsed.queueNumber)
            queueLabel = q ? `${q.name} (${q.number})` : `Fila ${parsed.queueNumber}`
            // destinationLabel fica null de propósito aqui — a coluna "Fila" já mostra esse
            // mesmo nome, repetir em "Destino" só duplica informação sem agregar nada
        } else if (parsed?.kind === 'flowNode') {
            const node = flowNodeById.get(parsed.flowNodeId)
            if (node) {
                const base = `Fluxo: ${node.flow.name}${node.label ? ` - ${node.label}` : ''}`
                destinationLabel = parsed.port ? `${base} (saída: ${parsed.port})` : base
            }
        }

        const timing = record.uniqueid ? queueTimingByUniqueid.get(record.uniqueid) : undefined

        return {
            ...record,
            queueLabel,
            destinationLabel,
            answeredBy: (record.uniqueid && agentByUniqueid.get(record.uniqueid)) || null,
            originLabel:
                (record.originExtension && extensionByNumber.get(record.originExtension)) ||
                (record.src && extensionByNumber.get(record.src)) ||
                null,
            queueWaitSeconds: timing?.waitSeconds ?? null,
            queueTalkSeconds: timing?.talkSeconds ?? null
        }
    })
}
