import { openDB, type DBSchema, type IDBPDatabase } from "idb"

// Persistência local (IndexedDB) do canvas de Flows: toda edição de posição/conexão grava aqui
// antes de tentar o backend, então nada se perde se a aba fechar ou o PUT falhar no meio do caminho.
export type EdgeOperation =
    | {
          type: "connect"
          sourceNodeId: string
          sourcePort: string
          targetNodeId: string
      }
    | { type: "disconnect"; sourceNodeId: string; sourcePort: string }

type PendingRecord =
    | {
          id: string
          flowId: string
          kind: "position"
          nodeId: string
          x: number
          y: number
      }
    | {
          id: string
          flowId: string
          kind: "edge"
          key: string
          operation: EdgeOperation
      }

interface FlowCanvasDB extends DBSchema {
    pending: {
        key: string
        value: PendingRecord
    }
}

const DB_NAME = "sofon-flow-canvas"
const DB_VERSION = 1
const STORE_NAME = "pending"

let dbPromise: Promise<IDBPDatabase<FlowCanvasDB>> | null = null

function getDb() {
    if (!dbPromise)
        dbPromise = openDB<FlowCanvasDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" })
            },
        })
    return dbPromise
}

const positionId = (flowId: string, nodeId: string) => `${flowId}|pos|${nodeId}`
const edgeOpId = (flowId: string, key: string) => `${flowId}|edge|${key}`

export async function savePendingPosition(
    flowId: string,
    nodeId: string,
    position: { x: number; y: number }
) {
    const db = await getDb()
    await db.put(STORE_NAME, {
        id: positionId(flowId, nodeId),
        flowId,
        kind: "position",
        nodeId,
        x: position.x,
        y: position.y,
    })
}

export async function clearPendingPosition(flowId: string, nodeId: string) {
    const db = await getDb()
    await db.delete(STORE_NAME, positionId(flowId, nodeId))
}

export async function savePendingEdgeOp(
    flowId: string,
    key: string,
    operation: EdgeOperation
) {
    const db = await getDb()
    await db.put(STORE_NAME, {
        id: edgeOpId(flowId, key),
        flowId,
        kind: "edge",
        key,
        operation,
    })
}

export async function clearPendingEdgeOp(flowId: string, key: string) {
    const db = await getDb()
    await db.delete(STORE_NAME, edgeOpId(flowId, key))
}

export async function loadPendingForFlow(flowId: string): Promise<{
    positions: Map<string, { x: number; y: number }>
    edgeOps: Map<string, EdgeOperation>
}> {
    const db = await getDb()
    const all = await db.getAll(STORE_NAME)
    const positions = new Map<string, { x: number; y: number }>()
    const edgeOps = new Map<string, EdgeOperation>()
    for (const record of all) {
        if (record.flowId !== flowId) continue
        if (record.kind === "position")
            positions.set(record.nodeId, { x: record.x, y: record.y })
        else edgeOps.set(record.key, record.operation)
    }
    return { positions, edgeOps }
}

export async function clearPendingForNode(flowId: string, nodeId: string) {
    await clearPendingPosition(flowId, nodeId)
    const { edgeOps } = await loadPendingForFlow(flowId)
    for (const [key, operation] of edgeOps)
        if (
            operation.sourceNodeId === nodeId ||
            (operation.type === "connect" && operation.targetNodeId === nodeId)
        )
            await clearPendingEdgeOp(flowId, key)
}

// Descartar alterações (ver discardDraft em flow-canvas.tsx): apaga toda posição/conexão ainda não
// sincronizada deste flow de uma vez, sem precisar saber os ids envolvidos.
export async function clearAllPendingForFlow(flowId: string) {
    const db = await getDb()
    const all = await db.getAll(STORE_NAME)
    await Promise.all(
        all
            .filter((record) => record.flowId === flowId)
            .map((record) => db.delete(STORE_NAME, record.id))
    )
}
