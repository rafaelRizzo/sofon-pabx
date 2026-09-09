import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { CanvasNodeType } from "@/components/Flows/node-types"

// Persistência do modo "auto save desligado" do editor de flow: com o toggle off, NADA (posição,
// conexão, criação/edição/exclusão de nó ou do recurso por trás dele) vai pro backend na hora -
// tudo fica só aqui, sobrevive a reload/fechar aba, e só sai daqui quando o usuário clica em
// "Salvar" (ver saveDraft em flow-canvas.tsx). Posição de nó e conexão de edge continuam usando o
// buffer já existente em flow-canvas-db.ts (mesma forma, só que sem o auto-flush pro backend
// enquanto o toggle está off) - este arquivo cobre só o que aquele não cobria: criar/editar/excluir
// nó e recurso.
export type DraftNodeCreation = {
    localId: string
    type: CanvasNodeType
    // id real de um recurso já existente (nó ligado a algo que já existia antes do draft) ou o
    // draftId de um DraftResourceCreation abaixo (recurso criado dentro do próprio draft)
    resourceId: string
    label: string | null
    position: { x: number; y: number }
}

export type DraftResourceCreation = {
    draftId: string
    type: CanvasNodeType
    companyId: string
    form: unknown
    label: string
}

export type DraftResourceUpdate = {
    resourceId: string
    type: CanvasNodeType
    form: unknown
}

export type DraftResourceDeletion = {
    nodeId: string
    type: CanvasNodeType
    resourceId: string
}

export type FlowDraftSnapshot = {
    flowId: string
    nodeCreations: DraftNodeCreation[]
    resourceCreations: DraftResourceCreation[]
    resourceUpdates: DraftResourceUpdate[]
    resourceDeletions: DraftResourceDeletion[]
    nodeDeletions: string[]
    // último set/clear de entrada do flow, ainda não sincronizado - "último ganha" (mesma
    // semântica do online, onde cada clique já dispara 1 PUT isolado com o nó alvo)
    entryDirty: boolean
    entryNodeId: string | null
    entryIsEntry: boolean
    startDirty: boolean
    startPosition: { x: number; y: number } | null
}

interface FlowDraftDB extends DBSchema {
    drafts: {
        key: string
        value: FlowDraftSnapshot
    }
}

const DB_NAME = "sofon-flow-draft"
const DB_VERSION = 1
const STORE_NAME = "drafts"

let dbPromise: Promise<IDBPDatabase<FlowDraftDB>> | null = null

function getDb() {
    if (!dbPromise)
        dbPromise = openDB<FlowDraftDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME, { keyPath: "flowId" })
            },
        })
    return dbPromise
}

export async function saveFlowDraft(snapshot: FlowDraftSnapshot) {
    const db = await getDb()
    await db.put(STORE_NAME, snapshot)
}

export async function loadFlowDraft(
    flowId: string
): Promise<FlowDraftSnapshot | null> {
    const db = await getDb()
    return (await db.get(STORE_NAME, flowId)) ?? null
}

export async function clearFlowDraft(flowId: string) {
    const db = await getDb()
    await db.delete(STORE_NAME, flowId)
}

export function isDraftDirty(snapshot: FlowDraftSnapshot | null): boolean {
    if (!snapshot) return false
    return (
        snapshot.nodeCreations.length > 0 ||
        snapshot.resourceCreations.length > 0 ||
        snapshot.resourceUpdates.length > 0 ||
        snapshot.resourceDeletions.length > 0 ||
        snapshot.nodeDeletions.length > 0 ||
        snapshot.entryDirty ||
        snapshot.startDirty
    )
}
