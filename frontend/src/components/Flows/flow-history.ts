"use client"

import { useCallback, useMemo, useReducer, useRef } from "react"

import type { FlowNodeEdge, FlowNodeInstance } from "@/hooks/use-flows"
import type { CanvasNodeType } from "@/components/Flows/node-types"

type Point = { x: number; y: number }

// Histórico em memória do editor de flow — uma entrada por ação atômica concluída no canvas.
// kind "create-node" (recurso já existia, ex. escolhido via popover de conexão) e
// "create-resource-node" (recurso criado pelo próprio canvas) são variantes separadas porque o
// inverso difere: desfazer a primeira só remove o nó; desfazer a segunda remove nó E recurso.
// `nodeId`/`resourceId` de create-resource-node e `node` de delete-node/delete-resource são
// mutados in-place a cada undo/redo que recria a entidade (novo id do backend) — a pilha em si
// nunca é substituída, só os campos desses objetos, ver `resolveNodeId`/nodeIdMapRef em flow-canvas.tsx.
export type HistoryAction =
    | { kind: "move-node"; nodeId: string; from: Point; to: Point }
    | { kind: "move-start"; from: Point; to: Point }
    | {
        kind: "create-node"
        nodeId: string
        type: CanvasNodeType
        resourceId: string
        label: string | null
        position: Point
    }
    | {
        kind: "create-resource-node"
        nodeId: string
        resourceType: CanvasNodeType
        resourceId: string
        label: string | null
        position: Point
        creationDto: unknown
    }
    | {
        kind: "connect-edge"
        sourceNodeId: string
        sourcePort: string
        targetNodeId: string
        previousTargetNodeId: string | null
    }
    | {
        kind: "disconnect-edge"
        sourceNodeId: string
        sourcePort: string
        targetNodeId: string
    }
    | { kind: "change-entry"; from: string | null; to: string | null }
    | {
        kind: "delete-node"
        node: FlowNodeInstance
        incomingEdges: FlowNodeEdge[]
        outgoingEdges: FlowNodeEdge[]
        wasEntry: boolean
    }
    | {
        kind: "delete-resource"
        node: FlowNodeInstance
        resourceType: CanvasNodeType
        creationDto: unknown
        incomingEdges: FlowNodeEdge[]
        outgoingEdges: FlowNodeEdge[]
        wasEntry: boolean
    }

export type HistoryDirection = "undo" | "redo"

const MAX_HISTORY = 50

// Controlador de undo/redo do canvas — pilhas em memória, zeradas ao desmontar (trocar de flow ou
// recarregar a página). `applyAction` é injetado depois via `setApplyAction` (não como argumento
// do hook) porque ele precisa fechar sobre os comandos do canvas (connectNodes, deleteNode etc.),
// que por sua vez chamam `push` — passar a função direto criaria dependência circular na montagem
// dos hooks. `busyRef` cumpre duas funções: serializa undo/redo entre si e suprime `push` enquanto
// uma ação está sendo re-executada (evitando registrar histórico do próprio replay).
export function useFlowHistory() {
    const undoStack = useRef<HistoryAction[]>([])
    const redoStack = useRef<HistoryAction[]>([])
    const busyRef = useRef(false)
    const applyActionRef = useRef<
        ((action: HistoryAction, direction: HistoryDirection) => Promise<void>) | null
    >(null)
    const [tick, forceRender] = useReducer((n: number) => n + 1, 0)

    const setApplyAction = useCallback(
        (fn: (action: HistoryAction, direction: HistoryDirection) => Promise<void>) => {
            applyActionRef.current = fn
        },
        []
    )

    const push = useCallback((action: HistoryAction) => {
        if (busyRef.current) return
        undoStack.current.push(action)
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
        redoStack.current = []
        forceRender()
    }, [])

    const run = useCallback(async (direction: HistoryDirection) => {
        const sourceStack = direction === "undo" ? undoStack : redoStack
        const destStack = direction === "undo" ? redoStack : undoStack
        if (busyRef.current || sourceStack.current.length === 0) return
        if (!applyActionRef.current) return
        busyRef.current = true
        forceRender()
        const action = sourceStack.current.pop()!
        try {
            await applyActionRef.current(action, direction)
            destStack.current.push(action)
        } catch {
            // reconciliação com o backend e o toast de erro já acontecem dentro do comando que
            // falhou — aqui só devolvemos a ação pra MESMA pilha de origem, pra permitir retry sem
            // fabricar/perder nada na pilha oposta.
            sourceStack.current.push(action)
        } finally {
            busyRef.current = false
            forceRender()
        }
    }, [])

    const undo = useCallback(() => void run("undo"), [run])
    const redo = useCallback(() => void run("redo"), [run])

    // push/undo/redo/setApplyAction são estáveis (deps vazias ou só de outras funções estáveis) —
    // memoizar o objeto retornado por `tick` evita recriar sua identidade a cada render. Sem isso,
    // qualquer código que ponha `history` (em vez de `history.push` etc.) numa lista de
    // dependências de useCallback/useEffect recria essas dependências a cada render, o que pode
    // reagendar efeitos que chamam setState incondicionalmente e travar em loop
    // ("Maximum update depth exceeded"). `tick` muda só quando push/undo/redo de fato mexem nas
    // pilhas, então canUndo/canRedo/isBusy continuam corretos.
    return useMemo(
        () => ({
            push,
            undo,
            redo,
            setApplyAction,
            canUndo: undoStack.current.length > 0,
            canRedo: redoStack.current.length > 0,
            isBusy: busyRef.current,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [push, undo, redo, setApplyAction, tick]
    )
}
