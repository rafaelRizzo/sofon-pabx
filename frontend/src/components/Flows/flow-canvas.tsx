"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    ControlButton,
    MiniMap,
    useStore,
    useStoreApi,
    applyNodeChanges,
    applyEdgeChanges,
    type Connection,
    type Edge,
    type EdgeChange,
    type EdgeTypes,
    type Node,
    type NodeChange,
    type NodeTypes,
    type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "@/components/Flows/flow-canvas.css"
import { useQuery } from "@tanstack/react-query"
import {
    CloudIcon,
    CloudOffIcon,
    Loader2Icon,
    LockIcon,
    MinusIcon,
    PanelRightCloseIcon,
    PanelRightOpenIcon,
    PlusIcon,
    RotateCcwIcon,
    SaveIcon,
    SearchIcon,
    UnlockIcon,
    WandSparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { api, apiError, isValidationError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
    ROUTE_DEST_ICONS,
    type DestinationOption,
} from "@/components/RouteDestination/route-destination-field"
import { CreateNodeDialog } from "@/components/Flows/create-node-dialog"
import { EditNodeDialog } from "@/components/Flows/edit-node-dialog"
import { NodeActionDialog } from "@/components/Flows/node-action-dialog"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
    DeletableEdge,
    type DeletableEdgeData,
} from "@/components/Flows/deletable-edge"
import {
    FlowNode,
    StartNode,
    type FlowNodeData,
} from "@/components/Flows/flow-node"
import {
    NODE_TYPE_CONFIG,
    NODE_ACTION_LABELS,
    NODE_ACTIONS,
    type CanvasNodeAction,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import {
    useFlowNodes,
    type Flow,
    type FlowNodeEdge,
    type FlowNodeInstance,
} from "@/hooks/use-flows"
import { type Company } from "@/hooks/use-companies"
import {
    savePendingPosition,
    clearPendingPosition,
    savePendingEdgeOp,
    clearPendingEdgeOp,
    loadPendingForFlow,
    clearPendingForNode,
    clearAllPendingForFlow,
    type EdgeOperation,
} from "@/lib/flow-canvas-db"
import {
    saveFlowDraft,
    loadFlowDraft,
    clearFlowDraft,
    isDraftDirty,
    type DraftNodeCreation,
    type DraftResourceCreation,
    type DraftResourceUpdate,
    type DraftResourceDeletion,
} from "@/lib/flow-draft-db"
import {
    useFlowHistory,
    type HistoryAction,
    type HistoryDirection,
} from "@/components/Flows/flow-history"
import {
    useAnnouncements,
    type AnnouncementForm,
} from "@/hooks/use-announcements"
import {
    useQueues,
    type QueueForm,
    type QueueUpdateForm,
} from "@/hooks/use-queues"
import {
    useRequestTemplates,
    type RequestTemplateForm,
    type RequestTemplateUpdateForm,
} from "@/hooks/use-request-templates"
import {
    useIxcNodes,
    type IxcNodeForm,
    type IxcNodeUpdateForm,
} from "@/hooks/use-ixc-nodes"
import {
    useFormatterNodes,
    type FormatterNodeForm,
    type FormatterNodeUpdateForm,
} from "@/hooks/use-formatter-nodes"
import {
    useTimeConditions,
    type TimeConditionForm,
    type TimeConditionCreationDto,
} from "@/hooks/use-time-conditions"
import {
    useHolidayGroups,
    type HolidayGroupForm,
    type HolidayGroupUpdateForm,
} from "@/hooks/use-holiday-groups"
import {
    useVariables,
    type VariableSetForm,
    type VariableSetUpdateForm,
} from "@/hooks/use-variables"
import {
    useVariableConditions,
    type VariableConditionForm,
    type VariableConditionUpdateForm,
} from "@/hooks/use-variable-conditions"
import {
    useIvr,
    type IvrMenuCreationDto,
    type IvrMenuForm,
} from "@/hooks/use-ivr"
import { useExtensions, type ExtensionUpdateForm } from "@/hooks/use-extensions"
import { useFlows } from "@/hooks/use-flows"

const START_KEY = "start"
const MINI_MAP_IDLE_DELAY = 1200
const EDGE_SYNC_DEBOUNCE_MS = 350
const EDGE_SYNC_MAX_DELAY_MS = 30000
const NODE_PANEL_STORAGE_KEY = "flow-canvas:node-panel-open"
const NODE_ACTION_DRAG_TYPE = "application/flow-node-action"
// Prefixos dos ids locais usados só quando auto save está desligado - nunca mandados pro backend
// como se fossem reais (ver saveDraft: todo id com esse prefixo é resolvido pro id de verdade antes
// de qualquer chamada de API). "pending:" (já existente) continua sendo só o id efêmero do meio
// segundo entre o POST otimista e a resposta do backend com auto save ligado - semântica diferente.
const DRAFT_NODE_PREFIX = "draft-node:"
const DRAFT_RES_PREFIX = "draft-res:"
const autoSaveStorageKey = (flowId: string) => `flow-canvas:autosave:${flowId}`

// Handles dos nós são Top (target) / Bottom (source) - o flow lê de cima pra baixo, então o
// auto-layout roda na mesma direção pra não gerar setas em ziguezague ou de baixo pra cima.
// elkjs é pesado (~500kB) e só serve pro botão "Auto Layout" - import dinâmico evita que ele
// entre no bundle inicial da rota, só carrega quando alguém de fato clica no botão.
type ElkInstance = InstanceType<
    (typeof import("elkjs/lib/elk.bundled.js"))["default"]
>
let elkInstance: Promise<ElkInstance> | null = null
function getElk(): Promise<ElkInstance> {
    elkInstance ??= import("elkjs/lib/elk.bundled.js").then(
        (m) => new m.default()
    )
    return elkInstance
}
const AUTO_LAYOUT_OPTIONS = {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.layered.spacing.nodeNodeBetweenLayers": "96",
    "elk.spacing.nodeNode": "64",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
}
const AUTO_LAYOUT_DEFAULT_SIZE = { width: 224, height: 96 }
const POSITION_RETRY_BASE_DELAY_MS = 1500
const POSITION_RETRY_MAX_DELAY_MS = 30000

function normalizeSearchText(text: string) {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
}

const NODE_TYPES: NodeTypes = {
    flowNode: FlowNode as any,
    startNode: StartNode,
}
const EDGE_TYPES: EdgeTypes = { deletable: DeletableEdge as any }

function edgeStyleForSlot(slot: string) {
    const stroke = {
        true: "var(--flow-branch-positive)",
        success: "var(--flow-branch-positive)",
        false: "var(--flow-branch-negative)",
        error: "var(--flow-branch-negative)",
    }[slot]
    return { strokeWidth: 2, ...(stroke && { stroke }) }
}

type Props = {
    flow: Flow
    companies: Company[]
    // Buscado no componente pai (flows.$id.tsx) em paralelo com o flow, pra tela mostrar um único
    // loading em vez de "carrega o flow, depois carrega os nós" em sequência.
    flowNodesState: ReturnType<typeof useFlowNodes>
}

function applyEdgeOperations(
    edges: FlowNodeEdge[],
    operations: Iterable<EdgeOperation>
): FlowNodeEdge[] {
    const byPort = new Map(
        edges.map((edge) => [`${edge.sourceNodeId}:${edge.sourcePort}`, edge])
    )
    const now = new Date().toISOString()
    for (const operation of operations) {
        const key = `${operation.sourceNodeId}:${operation.sourcePort}`
        if (operation.type === "disconnect") {
            byPort.delete(key)
            continue
        }
        const current = byPort.get(key)
        byPort.set(key, {
            id: current?.id ?? `pending:${key}`,
            flowId: current?.flowId ?? "pending",
            sourceNodeId: operation.sourceNodeId,
            sourcePort: operation.sourcePort,
            targetNodeId: operation.targetNodeId,
            createdAt: current?.createdAt ?? now,
            updatedAt: now,
        })
    }
    return [...byPort.values()]
}

function FlowCanvasInner({ flow, companies, flowNodesState }: Props) {
    const {
        nodes: flowNodes,
        setNodes: setFlowNodes,
        edges: flowEdges,
        entryNodeId,
        setEntryNodeId,
        loading,
        refreshing,
        refetchNodes,
        setEdges: setFlowEdges,
    } = flowNodesState
    const { allIvrMenus, createIvrMenu, updateIvrMenu } = useIvr(
        flow.companyId
    )
    const ivrById = useMemo(
        () => new Map(allIvrMenus.map((menu) => [menu.id, menu])),
        [allIvrMenus]
    )
    const [rfNodes, setRfNodes] = useState<Node[]>([])
    const [rfEdges, setRfEdges] = useState<Edge[]>([])
    const [isNodePanelOpen, setIsNodePanelOpen] = useState(
        () => localStorage.getItem(NODE_PANEL_STORAGE_KEY) !== "closed"
    )
    const [nodeActionSearch, setNodeActionSearch] = useState("")
    useEffect(() => {
        localStorage.setItem(
            NODE_PANEL_STORAGE_KEY,
            isNodePanelOpen ? "open" : "closed"
        )
    }, [isNodePanelOpen])
    const [pendingAction, setPendingAction] = useState<CanvasNodeAction | null>(
        null
    )
    const [pendingCreation, setPendingCreation] = useState<{
        type: CanvasNodeType
        source?: { nodeId: string; port: string }
        position?: { x: number; y: number }
    } | null>(null)
    const [editingNode, setEditingNode] = useState<{
        nodeId: string
        type: CanvasNodeType
        resourceId: string
        name: string
    } | null>(null)
    const [resourceToDelete, setResourceToDelete] = useState<{
        nodeId: string
        type: CanvasNodeType
        resourceId: string
        name: string
        creationDto: unknown
    } | null>(null)
    // "Início do flow" é sintético (não é um FlowNode no banco, não tem id real) - a posição dele
    // não cabe no PUT /nodes/:nodeId. Usa o campo Flow.layout (já existia no schema, sem uso até
    // agora) só pra esse único item.
    const [startPosition, setStartPosition] = useState<{
        x: number
        y: number
    }>(() => {
        const saved = flow.layout?.find((item) => item.nodeId === START_KEY)
        return saved ? { x: saved.x, y: saved.y } : { x: 80, y: 40 }
    })
    const startSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingPositions = useRef(new Map<string, { x: number; y: number }>())
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const edgeSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const edgeSyncInFlight = useRef(false)
    const edgeSyncBackoff = useRef(EDGE_SYNC_DEBOUNCE_MS)
    const edgeSyncErrorNotified = useRef(false)
    const positionRetryBackoff = useRef(POSITION_RETRY_BASE_DELAY_MS)
    const positionErrorNotified = useRef(false)
    const pendingEdgeOperations = useRef(new Map<string, EdgeOperation>())
    const pendingNodeIds = useRef(new Set<string>())
    const flushEdgeOperationsRef = useRef<() => void>(() => {})
    const hydratedFlowRef = useRef<string | null>(null)
    const miniMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isMiniMapVisible, setIsMiniMapVisible] = useState(true)
    const [isSyncingEdges, setIsSyncingEdges] = useState(false)
    // contador em vez de boolean - deletar vários nós de uma vez (seleção múltipla + teclado)
    // dispara várias chamadas deleteNodeCore em paralelo; um boolean simples desligaria o
    // indicador assim que a primeira terminasse, mesmo com outras ainda em voo.
    const [deletingNodeCount, setDeletingNodeCount] = useState(0)
    const canvasRootRef = useRef<HTMLDivElement>(null)
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null)
    const contextPositionRef = useRef<{ x: number; y: number } | null>(null)

    // Auto save: ligado (padrão, preserva o comportamento de sempre) = toda edição vai pro backend
    // na hora, como já acontecia. Desligado = nada sai daqui - fica só nestes refs + IndexedDB
    // (flow-draft-db.ts) até o usuário clicar em "Salvar" (ver saveDraft abaixo). Por flow
    // (localStorage), não global - flows diferentes podem ter preferências diferentes.
    const [autoSave, setAutoSaveState] = useState<boolean>(
        () => localStorage.getItem(autoSaveStorageKey(flow.id)) !== "off"
    )
    const autoSaveRef = useRef(autoSave)
    useEffect(() => {
        autoSaveRef.current = autoSave
    }, [autoSave])
    // nós/recursos criados 100% dentro do draft atual (nunca existiram no backend) - chave = localId
    // (nó) / draftId (recurso). "Cancelar" (excluir antes de salvar) só remove daqui, sem rede.
    const draftNodeCreations = useRef(new Map<string, DraftNodeCreation>())
    const draftResourceCreations = useRef(
        new Map<string, DraftResourceCreation>()
    )
    // edição de recurso que já existia antes deste draft - last-write-wins por resourceId
    const draftResourceUpdates = useRef(new Map<string, DraftResourceUpdate>())
    // exclusão de nó+recurso que já existiam antes deste draft - chave = nodeId
    const draftResourceDeletions = useRef(
        new Map<string, DraftResourceDeletion>()
    )
    // exclusão de nó (sem recurso, ex. "extension"/"flow") que já existia antes deste draft
    const draftNodeDeletions = useRef(new Set<string>())
    const draftEntry = useRef<{
        dirty: boolean
        nodeId: string | null
        isEntry: boolean
    }>({ dirty: false, nodeId: null, isEntry: true })
    const draftStart = useRef<{
        dirty: boolean
        position: { x: number; y: number } | null
    }>({ dirty: false, position: null })
    const draftPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(
        null
    )
    const [draftVersion, setDraftVersion] = useState(0)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [isDiscardingDraft, setIsDiscardingDraft] = useState(false)
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
    const [showSaveConfirm, setShowSaveConfirm] = useState(false)

    // Grava o snapshot inteiro do draft imediatamente - posição de nó e conexão de edge continuam
    // usando o buffer próprio já existente (flow-canvas-db.ts), reaproveitado tal como está.
    const flushDraftSnapshot = useCallback(() => {
        void saveFlowDraft({
            flowId: flow.id,
            nodeCreations: [...draftNodeCreations.current.values()],
            resourceCreations: [...draftResourceCreations.current.values()],
            resourceUpdates: [...draftResourceUpdates.current.values()],
            resourceDeletions: [...draftResourceDeletions.current.values()],
            nodeDeletions: [...draftNodeDeletions.current],
            entryDirty: draftEntry.current.dirty,
            entryNodeId: draftEntry.current.nodeId,
            entryIsEntry: draftEntry.current.isEntry,
            startDirty: draftStart.current.dirty,
            startPosition: draftStart.current.position,
        })
    }, [flow.id])

    // Debounced (300ms) pra não bater no IndexedDB a cada tecla/drag - mas sobrevive a sair da
    // página (ver useEffect de flush no unmount abaixo), que senão perdia qualquer edição feita
    // nesses últimos 300ms.
    const persistDraftSnapshot = useCallback(() => {
        if (draftPersistTimer.current) clearTimeout(draftPersistTimer.current)
        draftPersistTimer.current = setTimeout(flushDraftSnapshot, 300)
    }, [flushDraftSnapshot])

    // Chamar depois de QUALQUER mutação nos refs de draft acima - persiste em IndexedDB e força
    // re-render pra badge de "N alterações pendentes" (refs sozinhos não disparam re-render).
    const markDraftDirty = useCallback(() => {
        persistDraftSnapshot()
        setDraftVersion((v) => v + 1)
    }, [persistDraftSnapshot])

    // Trocar de flow ou sair da página (navegação SPA) desmonta este componente sem esperar o
    // debounce acima - sem isso, a última edição em até 300ms ficava só na memória e sumia.
    useEffect(() => {
        return () => {
            if (draftPersistTimer.current) {
                clearTimeout(draftPersistTimer.current)
                flushDraftSnapshot()
            }
        }
    }, [flushDraftSnapshot])

    const draftDirtyCount = useMemo(
        () =>
            draftNodeCreations.current.size +
            draftResourceUpdates.current.size +
            draftResourceDeletions.current.size +
            draftNodeDeletions.current.size +
            (draftEntry.current.dirty ? 1 : 0) +
            (draftStart.current.dirty ? 1 : 0) +
            pendingPositions.current.size +
            pendingEdgeOperations.current.size,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [draftVersion]
    )

    // Histórico undo/redo (ver flow-history.ts) - em memória, zerado ao desmontar (trocar de flow
    // ou recarregar a página).
    const history = useFlowHistory()

    // Ids de nó recriados por undo/redo (o backend nunca restaura o id excluído - recriar sempre
    // gera um id novo). Encadeia ida->novo pra qualquer outra ação da pilha (ex. um move-node ou
    // connect-edge anterior) resolver pro id vivo atual em vez do id histórico já morto.
    const nodeIdMapRef = useRef(new Map<string, string>())
    const resolveNodeId = useCallback((id: string) => {
        let current = id
        const seen = new Set<string>()
        while (nodeIdMapRef.current.has(current) && !seen.has(current)) {
            seen.add(current)
            current = nodeIdMapRef.current.get(current)!
        }
        return current
    }, [])

    // Espelhos em ref do estado corrente - usados pelos comandos de mutação (commitNodePosition,
    // deleteNode, deleteResource, connectNodes) pra ler o valor mais recente sem precisar desses
    // valores na lista de dependências do useCallback (evita recriar esses comandos, e portanto
    // onNodesChange/rfNodes, a cada mudança de estado).
    const flowNodesRef = useRef<FlowNodeInstance[]>([])
    const flowEdgesRef = useRef<FlowNodeEdge[]>([])
    const entryNodeIdRef = useRef<string | null>(null)
    useEffect(() => {
        flowNodesRef.current = flowNodes
    }, [flowNodes])
    useEffect(() => {
        flowEdgesRef.current = flowEdges
    }, [flowEdges])
    useEffect(() => {
        entryNodeIdRef.current = entryNodeId
    }, [entryNodeId])

    // Hooks de criação por tipo de recurso - usados só pra recriar um recurso excluído/desfeito
    // (ver recreateResource abaixo). O form de edição/criação de cada tipo já usa esses mesmos
    // hooks em edit-node-dialog.tsx/create-node-dialog.tsx.
    const { createAnnouncement, updateAnnouncement } = useAnnouncements()
    const { createQueue, updateQueue } = useQueues()
    const { createRequestTemplate, updateRequestTemplate } =
        useRequestTemplates()
    const { createIxcNode, updateIxcNode } = useIxcNodes()
    const { createFormatterNode, updateFormatterNode } = useFormatterNodes()
    const { createTimeCondition, updateTimeCondition } = useTimeConditions()
    const { createHolidayGroup, updateHolidayGroup } = useHolidayGroups()
    const { createVariableSet, updateVariableSet } = useVariables()
    const { createVariableCondition, updateVariableCondition } =
        useVariableConditions()
    const { updateExtension } = useExtensions()
    const { updateFlow } = useFlows()

    const showMiniMap = useCallback(() => {
        if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        setIsMiniMapVisible(true)
    }, [])

    const scheduleMiniMapHide = useCallback(() => {
        if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        miniMapTimer.current = setTimeout(
            () => setIsMiniMapVisible(false),
            MINI_MAP_IDLE_DELAY
        )
    }, [])

    useEffect(() => {
        scheduleMiniMapHide()
        return () => {
            if (miniMapTimer.current) clearTimeout(miniMapTimer.current)
        }
    }, [scheduleMiniMapHide])

    const isInteractive = useStore(
        (state) =>
            state.nodesDraggable ||
            state.nodesConnectable ||
            state.elementsSelectable
    )
    const isMaxZoomReached = useStore(
        (state) => state.transform[2] >= state.maxZoom
    )
    const isMinZoomReached = useStore(
        (state) => state.transform[2] <= state.minZoom
    )
    const storeApi = useStoreApi()
    const toggleInteractive = useCallback(() => {
        storeApi.setState({
            nodesDraggable: !isInteractive,
            nodesConnectable: !isInteractive,
            elementsSelectable: !isInteractive,
        })
    }, [storeApi, isInteractive])

    const nodeById = useMemo(
        () => new Map(flowNodes.map((node) => [node.id, node])),
        [flowNodes]
    )

    const filteredNodeActions = useMemo(() => {
        const query = normalizeSearchText(nodeActionSearch)
        if (!query) return NODE_ACTIONS
        return NODE_ACTIONS.filter((action) =>
            normalizeSearchText(`${action.label} ${action.description}`).includes(
                query
            )
        )
    }, [nodeActionSearch])

    // referência sempre atual dos ids de nó válidos - usada dentro de callbacks memoizados
    // (persistPositions) pra não reenfileirar posição de um nó já deletado numa race entre o PUT
    // em voo e um delete concorrente.
    const nodeIdsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        nodeIdsRef.current = new Set(flowNodes.map((node) => node.id))
    }, [flowNodes])

    const scheduleEdgeSync = useCallback((delay = EDGE_SYNC_DEBOUNCE_MS) => {
        // auto save desligado: a operação já foi gravada em IndexedDB por queueEdgeOperation (linha
        // abaixo) - só não agenda o envio pro backend. saveDraft chama flushEdgeOperations() direto.
        if (!autoSaveRef.current) return
        if (edgeSyncTimer.current) clearTimeout(edgeSyncTimer.current)
        edgeSyncTimer.current = setTimeout(
            () => flushEdgeOperationsRef.current(),
            delay
        )
    }, [])

    const flushEdgeOperations = useCallback(async () => {
        if (
            edgeSyncInFlight.current ||
            pendingEdgeOperations.current.size === 0
        )
            return

        const operations = [...pendingEdgeOperations.current.values()].filter(
            (operation) =>
                !pendingNodeIds.current.has(operation.sourceNodeId) &&
                (operation.type === "disconnect" ||
                    !pendingNodeIds.current.has(operation.targetNodeId))
        )
        if (operations.length === 0) return
        edgeSyncInFlight.current = true
        setIsSyncingEdges(true)
        for (const operation of operations)
            pendingEdgeOperations.current.delete(
                `${operation.sourceNodeId}:${operation.sourcePort}`
            )
        try {
            const { data } = await api.put(
                `/flows/${flow.id}/node-edges/batch`,
                {
                    operations,
                }
            )
            for (const operation of operations)
                void clearPendingEdgeOp(
                    flow.id,
                    `${operation.sourceNodeId}:${operation.sourcePort}`
                )
            setFlowEdges((current) =>
                applyEdgeOperations(
                    data.edges ?? current,
                    pendingEdgeOperations.current.values()
                )
            )
            edgeSyncBackoff.current = EDGE_SYNC_DEBOUNCE_MS
            edgeSyncErrorNotified.current = false
            edgeSyncInFlight.current = false
            setIsSyncingEdges(false)
            if (pendingEdgeOperations.current.size > 0) scheduleEdgeSync(0)
        } catch (err) {
            const permanent = isValidationError(err)
            // 4xx nunca vai vingar de tentar de novo (self-loop, ciclo, nó inexistente) - descarta
            // a operação de vez. Só erro transiente (rede/5xx) volta pra fila de retry.
            if (permanent)
                for (const operation of operations)
                    void clearPendingEdgeOp(
                        flow.id,
                        `${operation.sourceNodeId}:${operation.sourcePort}`
                    )
            else
                for (const operation of operations)
                    pendingEdgeOperations.current.set(
                        `${operation.sourceNodeId}:${operation.sourcePort}`,
                        operation
                    )
            try {
                const { data } = await api.get(`/flows/${flow.id}/nodes`)
                setFlowEdges(
                    applyEdgeOperations(
                        data.edges ?? [],
                        pendingEdgeOperations.current.values()
                    )
                )
            } catch {
                await refetchNodes()
            }
            if (permanent) {
                toast.warning(
                    apiError(err, "Não é possível criar essa conexão")
                )
            } else if (!edgeSyncErrorNotified.current) {
                edgeSyncErrorNotified.current = true
                toast.error(apiError(err, "Erro ao sincronizar conexões"))
            }
            edgeSyncInFlight.current = false
            setIsSyncingEdges(false)
            if (permanent) {
                if (pendingEdgeOperations.current.size > 0) scheduleEdgeSync(0)
                return
            }
            // backoff exponencial - sem isso, uma falha transiente persistente (rota fora do ar)
            // vira retry imediato em loop infinito martelando o backend.
            const delay = edgeSyncBackoff.current
            edgeSyncBackoff.current = Math.min(
                delay * 2,
                EDGE_SYNC_MAX_DELAY_MS
            )
            scheduleEdgeSync(delay)
        }
    }, [flow.id, refetchNodes, scheduleEdgeSync, setFlowEdges])

    useEffect(() => {
        flushEdgeOperationsRef.current = () => void flushEdgeOperations()
        return () => {
            if (edgeSyncTimer.current) clearTimeout(edgeSyncTimer.current)
            flushEdgeOperationsRef.current()
        }
    }, [flushEdgeOperations])

    const queueEdgeOperation = useCallback(
        (operation: EdgeOperation) => {
            const key = `${operation.sourceNodeId}:${operation.sourcePort}`
            pendingEdgeOperations.current.set(key, operation)
            void savePendingEdgeOp(flow.id, key, operation)
            setFlowEdges((current) => applyEdgeOperations(current, [operation]))
            scheduleEdgeSync()
            if (!autoSaveRef.current) markDraftDirty()
        },
        [flow.id, scheduleEdgeSync, setFlowEdges, markDraftDirty]
    )

    const disconnectNodes = useCallback(
        (sourceNodeId: string, sourcePort: string) =>
            queueEdgeOperation({
                type: "disconnect",
                sourceNodeId,
                sourcePort,
            }),
        [queueEdgeOperation]
    )

    const deleteEdge = useCallback(
        async (edgeId: string) => {
            try {
                const edge = flowEdgesRef.current.find(
                    (item) => item.id === edgeId
                )
                if (!edge) return
                disconnectNodes(edge.sourceNodeId, edge.sourcePort)
                history.push({
                    kind: "disconnect-edge",
                    sourceNodeId: edge.sourceNodeId,
                    sourcePort: edge.sourcePort,
                    targetNodeId: edge.targetNodeId,
                })
            } catch (err) {
                toast.error(apiError(err, "Erro ao remover conexão"))
            }
        },
        [disconnectNodes, history]
    )

    const reconcileNodes = useCallback(async () => {
        const { data } = await api.get(`/flows/${flow.id}/nodes`)
        setFlowNodes(data.nodes ?? [])
        setFlowEdges(data.edges ?? [])
        setEntryNodeId(data.entryNodeId ?? null)
    }, [flow.id, setEntryNodeId, setFlowEdges, setFlowNodes])

    const persistPositions = useCallback(async () => {
        // Nó recém-criado ainda não tem id real do backend (pending:<uuid>) - manda a posição dele
        // pro PUT/:nodeId 400 na validação (regex de cuid). Segura essa entrada até createNode
        // resolver o id de verdade e remapear (ver .then() de createNode).
        const entries = [...pendingPositions.current.entries()].filter(
            ([id]) => !pendingNodeIds.current.has(id)
        )
        if (entries.length === 0) return
        for (const [id] of entries) pendingPositions.current.delete(id)

        // allSettled, não all: um único id "zumbi" (nó deletado/nunca criado) não pode arrastar de
        // volta pro retry as posições que salvaram com sucesso no mesmo lote - Promise.all rejeitaria
        // o array inteiro por causa de 1 falha, fazendo entries que já deram 200 serem reenviadas
        // pra sempre junto do id que nunca vai vingar.
        const results = await Promise.allSettled(
            entries.map(([id, position]) =>
                api.put(`/flows/${flow.id}/nodes/${id}`, { position })
            )
        )

        let firstError: unknown
        for (let i = 0; i < entries.length; i++) {
            const [id, position] = entries[i]
            const result = results[i]
            if (result.status === "fulfilled") {
                void clearPendingPosition(flow.id, id)
                continue
            }
            firstError ??= result.reason
            // se o nó foi deletado enquanto o PUT estava em voo, não reenfileira a posição dele -
            // senão o retry martela pra sempre um nodeId que não existe mais.
            if (nodeIdsRef.current.has(id) || pendingNodeIds.current.has(id))
                pendingPositions.current.set(id, position)
            else void clearPendingPosition(flow.id, id)
        }

        if (firstError === undefined) {
            positionRetryBackoff.current = POSITION_RETRY_BASE_DELAY_MS
            positionErrorNotified.current = false
        } else {
            // backoff exponencial - sem isso, uma falha persistente (rota fora do ar, 404) vira
            // retry imediato em loop infinito martelando o backend.
            const delay = positionRetryBackoff.current
            positionRetryBackoff.current = Math.min(
                delay * 2,
                POSITION_RETRY_MAX_DELAY_MS
            )
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => void persistPositions(), delay)
            try {
                await reconcileNodes()
            } catch {
                // O próximo carregamento busca o estado autoritativo.
            }
            if (!positionErrorNotified.current) {
                positionErrorNotified.current = true
                toast.error(
                    apiError(firstError, "Erro ao salvar posição dos nós")
                )
            }
        }
    }, [flow.id, reconcileNodes])

    const removeNodeFromCanvas = useCallback(
        (nodeId: string) => {
            setFlowNodes((current) =>
                current.filter((node) => node.id !== nodeId)
            )
            setFlowEdges((current) =>
                current.filter(
                    (edge) =>
                        edge.sourceNodeId !== nodeId &&
                        edge.targetNodeId !== nodeId
                )
            )
            setEntryNodeId((current) => (current === nodeId ? null : current))
            for (const [key, operation] of pendingEdgeOperations.current)
                if (
                    operation.sourceNodeId === nodeId ||
                    (operation.type === "connect" &&
                        operation.targetNodeId === nodeId)
                )
                    pendingEdgeOperations.current.delete(key)
            pendingPositions.current.delete(nodeId)
            void clearPendingForNode(flow.id, nodeId)
        },
        [flow.id, setEntryNodeId, setFlowEdges, setFlowNodes]
    )

    // Chamada crua de exclusão de nó, sem snapshot/histórico - reaproveitada tanto pela exclusão
    // interativa (deleteNode abaixo) quanto pelo replay de undo/redo (applyHistoryAction), que já
    // fez seu próprio removeNodeFromCanvas e só precisa do resultado awaitable da chamada HTTP.
    const deleteNodeCore = useCallback(
        async (nodeId: string) => {
            // nó criado neste mesmo draft (nunca existiu no backend) - cancela a criação, sem rede.
            // Só remove draftNodeCreations: igual ao fluxo online, apagar o card não apaga o
            // recurso por trás dele (isso é "excluir recurso", ver deleteResourceCore abaixo) -
            // então o recurso do draft, se houver, continua marcado pra ser criado no "Salvar".
            if (draftNodeCreations.current.has(nodeId)) {
                draftNodeCreations.current.delete(nodeId)
                pendingNodeIds.current.delete(nodeId)
                markDraftDirty()
                return true
            }
            if (pendingNodeIds.current.has(nodeId)) return true
            if (!autoSaveRef.current) {
                // nó real (existia antes deste draft) - só enfileira, sem chamar a API agora.
                draftNodeDeletions.current.add(nodeId)
                markDraftDirty()
                return true
            }
            setDeletingNodeCount((count) => count + 1)
            try {
                await api.delete(`/flows/${flow.id}/nodes/${nodeId}`)
                return true
            } catch (err) {
                try {
                    await reconcileNodes()
                } catch {
                    // O próximo carregamento busca o estado autoritativo.
                }
                toast.error(apiError(err, "Erro ao remover nó"))
                return false
            } finally {
                setDeletingNodeCount((count) => count - 1)
            }
        },
        [flow.id, reconcileNodes, markDraftDirty]
    )

    const deleteNode = useCallback(
        (nodeId: string) => {
            const node = flowNodesRef.current.find((item) => item.id === nodeId)
            if (!node) return Promise.resolve(false)
            const incomingEdges = flowEdgesRef.current.filter(
                (edge) => edge.targetNodeId === nodeId
            )
            const outgoingEdges = flowEdgesRef.current.filter(
                (edge) => edge.sourceNodeId === nodeId
            )
            const wasEntry = entryNodeIdRef.current === nodeId
            removeNodeFromCanvas(nodeId)
            history.push({
                kind: "delete-node",
                node,
                incomingEdges,
                outgoingEdges,
                wasEntry,
            })
            return deleteNodeCore(nodeId)
        },
        [removeNodeFromCanvas, history, deleteNodeCore]
    )

    // Idem deleteNodeCore, mas pros 3 passos de exclusão de recurso (check + delete node + delete
    // recurso) - reaproveitado pela exclusão interativa (deleteResource) e pelo replay de
    // undo/redo (redo de delete-resource, undo de create-resource-node).
    const deleteResourceCore = useCallback(
        async (target: {
            nodeId: string
            type: CanvasNodeType
            resourceId: string
        }) => {
            const isDraftNode = draftNodeCreations.current.has(target.nodeId)
            const isDraftResource = draftResourceCreations.current.has(
                target.resourceId
            )
            if (isDraftNode || isDraftResource || !autoSaveRef.current) {
                // recurso (e/ou nó) criado neste mesmo draft - cancela, sem rede.
                if (isDraftNode) draftNodeCreations.current.delete(target.nodeId)
                if (isDraftResource)
                    draftResourceCreations.current.delete(target.resourceId)
                // recurso real (já existia antes deste draft) - enfileira a exclusão de verdade pro
                // "Salvar" (ver saveDraft - lá resolve se o nó também precisa ser apagado ou se,
                // como aqui, o nó nunca existiu de verdade e só o recurso precisa sair).
                else
                    draftResourceDeletions.current.set(target.nodeId, {
                        nodeId: target.nodeId,
                        type: target.type,
                        resourceId: target.resourceId,
                    })
                pendingNodeIds.current.delete(target.nodeId)
                markDraftDirty()
                return true
            }
            try {
                await api.post(
                    `/flows/${flow.id}/nodes/${target.nodeId}/resource-deletion-check`
                )
                await api.delete(`/flows/${flow.id}/nodes/${target.nodeId}`)
                await api.delete(
                    `/${NODE_TYPE_CONFIG[target.type].apiPath}/${target.resourceId}`
                )
                toast.success("Recurso e nó excluídos")
                return true
            } catch (err) {
                try {
                    await reconcileNodes()
                } catch {
                    // O próximo carregamento busca o estado autoritativo.
                }
                toast.error(apiError(err, "Erro ao excluir recurso"))
                return false
            }
        },
        [flow.id, reconcileNodes, markDraftDirty]
    )

    const deleteResource = useCallback(async () => {
        if (!resourceToDelete) return false
        const target = resourceToDelete
        setResourceToDelete(null)
        setEditingNode(null)
        const node = flowNodesRef.current.find(
            (item) => item.id === target.nodeId
        )
        if (!node) return false
        const incomingEdges = flowEdgesRef.current.filter(
            (edge) => edge.targetNodeId === target.nodeId
        )
        const outgoingEdges = flowEdgesRef.current.filter(
            (edge) => edge.sourceNodeId === target.nodeId
        )
        const wasEntry = entryNodeIdRef.current === target.nodeId
        removeNodeFromCanvas(target.nodeId)
        history.push({
            kind: "delete-resource",
            node,
            resourceType: target.type,
            creationDto: target.creationDto,
            incomingEdges,
            outgoingEdges,
            wasEntry,
        })
        void deleteResourceCore(target)
        return true
    }, [resourceToDelete, removeNodeFromCanvas, history, deleteResourceCore])

    const connectNodes = useCallback(
        (sourceNodeId: string, sourcePort: string, targetNodeId: string) => {
            const previous = flowEdgesRef.current.find(
                (edge) =>
                    edge.sourceNodeId === sourceNodeId &&
                    edge.sourcePort === sourcePort
            )
            const previousTargetNodeId = previous?.targetNodeId ?? null
            queueEdgeOperation({
                type: "connect",
                sourceNodeId,
                sourcePort,
                targetNodeId,
            })
            if (previousTargetNodeId !== targetNodeId)
                history.push({
                    kind: "connect-edge",
                    sourceNodeId,
                    sourcePort,
                    targetNodeId,
                    previousTargetNodeId,
                })
        },
        [queueEdgeOperation, history]
    )

    // Retornam Promise<boolean> (nunca rejeitam) - o replay de undo/redo (applyHistoryAction)
    // precisa saber se a chamada deu certo pra decidir se a ação volta pra pilha; os chamadores
    // interativos (onConnect etc.) seguem ignorando o retorno como antes.
    const setEntry = useCallback(
        (nodeId: string) => {
            const from = entryNodeIdRef.current
            setEntryNodeId(nodeId)
            history.push({ kind: "change-entry", from, to: nodeId })
            if (!autoSaveRef.current) {
                // nodeId pode ser um id local (nó criado neste mesmo draft) - resolveNodeId em
                // saveDraft traduz pro id real depois que o nó for materializado no backend.
                draftEntry.current = { dirty: true, nodeId, isEntry: true }
                markDraftDirty()
                return Promise.resolve(true)
            }
            return api
                .put(`/flows/${flow.id}/nodes/${nodeId}`, { isEntry: true })
                .then(
                    () => true,
                    async (err) => {
                        try {
                            await reconcileNodes()
                        } catch {
                            // O próximo carregamento busca o estado autoritativo.
                        }
                        toast.error(
                            apiError(err, "Erro ao definir início do flow")
                        )
                        return false
                    }
                )
        },
        [flow.id, reconcileNodes, setEntryNodeId, history, markDraftDirty]
    )

    const clearEntry = useCallback(
        (nodeId: string) => {
            const from = entryNodeIdRef.current
            setEntryNodeId((current) => (current === nodeId ? null : current))
            history.push({ kind: "change-entry", from, to: null })
            if (!autoSaveRef.current) {
                draftEntry.current = { dirty: true, nodeId, isEntry: false }
                markDraftDirty()
                return Promise.resolve(true)
            }
            return api
                .put(`/flows/${flow.id}/nodes/${nodeId}`, { isEntry: false })
                .then(
                    () => true,
                    async (err) => {
                        try {
                            await reconcileNodes()
                        } catch {
                            // O próximo carregamento busca o estado autoritativo.
                        }
                        toast.error(
                            apiError(err, "Erro ao remover início do flow")
                        )
                        return false
                    }
                )
        },
        [flow.id, reconcileNodes, setEntryNodeId, history, markDraftDirty]
    )

    // Recria um recurso a partir do DTO de criação capturado antes da exclusão (ver
    // toXCreationDto nos hooks use-*.ts e onDeleteResource em edit-node-dialog.tsx/create-node-dialog.tsx)
    // - usado só pelo histórico de undo/redo (recriar recurso excluído, ou recriar recurso cuja
    // criação foi desfeita). companyId nunca vem do DTO: a recriação sempre cai na empresa do
    // próprio flow. extension/flow nunca chegam aqui (creatable:false e sem exclusão de recurso,
    // ver NODE_TYPE_CONFIG/edit-node-dialog.tsx) - cobertos só pra exaustividade do switch.
    const recreateResource = useCallback(
        async (
            type: CanvasNodeType,
            creationDto: unknown,
            companyId: string
        ): Promise<string | null> => {
            switch (type) {
                case "announcement":
                    return createAnnouncement(
                        creationDto as AnnouncementForm,
                        companyId,
                        true
                    )
                case "queue":
                    return createQueue(
                        {
                            ...(creationDto as QueueUpdateForm),
                            companyId,
                        } as QueueForm,
                        true
                    )
                case "request":
                    return createRequestTemplate(
                        {
                            ...(creationDto as RequestTemplateUpdateForm),
                            companyId,
                        } as RequestTemplateForm,
                        companyId,
                        true
                    )
                case "ixc":
                    return createIxcNode(
                        {
                            ...(creationDto as IxcNodeUpdateForm),
                            companyId,
                        } as IxcNodeForm,
                        companyId,
                        true
                    )
                case "formatter":
                    return createFormatterNode(
                        {
                            ...(creationDto as FormatterNodeUpdateForm),
                            companyId,
                        } as FormatterNodeForm,
                        companyId,
                        true
                    )
                case "timecondition":
                    return createTimeCondition(
                        {
                            ...(creationDto as TimeConditionCreationDto),
                            companyId,
                        } as TimeConditionForm,
                        true
                    )
                case "holiday":
                    return createHolidayGroup(
                        {
                            ...(creationDto as HolidayGroupUpdateForm),
                            companyId,
                        } as HolidayGroupForm,
                        true
                    )
                case "variable-set":
                    return createVariableSet(
                        {
                            ...(creationDto as VariableSetUpdateForm),
                            companyId,
                        } as VariableSetForm,
                        true
                    )
                case "variable-condition":
                    return createVariableCondition(
                        {
                            ...(creationDto as VariableConditionUpdateForm),
                            companyId,
                        } as VariableConditionForm,
                        true
                    )
                case "ivr": {
                    const resourceId = await createIvrMenu(
                        {
                            ...(creationDto as IvrMenuCreationDto),
                            companyId,
                        } as IvrMenuForm,
                        companyId
                    )
                    return resourceId || null
                }
                case "extension":
                case "flow":
                    return null
            }
        },
        [
            createAnnouncement,
            createQueue,
            createRequestTemplate,
            createIxcNode,
            createFormatterNode,
            createTimeCondition,
            createHolidayGroup,
            createVariableSet,
            createVariableCondition,
        ]
    )

    // Mesma fórmula de label usada em create-node-dialog.tsx ao criar cada tipo - reaproveitada
    // aqui pra nomear um recurso de rascunho (sem back-end pra devolver o registro completo ainda).
    const labelForDraftResource = useCallback(
        (type: CanvasNodeType, form: Record<string, unknown>): string => {
            if (type === "queue")
                return `${form.name as string} (${form.number as string})`
            return (form.name as string) ?? "Recurso"
        },
        []
    )

    // Registra um form de criação como rascunho local (sem nenhuma chamada de rede) e devolve um id
    // local (draft-res:<uuid>) pra usar no lugar do resourceId real - só materializa de verdade
    // (recreateResource) no clique de "Salvar" (ver saveDraft).
    const createDraftResource = useCallback(
        (
            type: CanvasNodeType,
            form: unknown,
            label: string,
            companyId: string
        ): string => {
            const draftId = `${DRAFT_RES_PREFIX}${crypto.randomUUID()}`
            draftResourceCreations.current.set(draftId, {
                draftId,
                type,
                companyId,
                form,
                label,
            })
            markDraftDirty()
            return draftId
        },
        [markDraftDirty]
    )

    // Variante de recreateResource usada pelo histórico de undo/redo (applyHistoryAction): com auto
    // save desligado, "recriar" um recurso excluído (ou refazer uma criação desfeita) não pode
    // chamar a API de verdade - vira só outro registro de rascunho, exatamente como se o usuário
    // tivesse criado o recurso agora pela primeira vez.
    const recreateResourceDraftAware = useCallback(
        async (
            type: CanvasNodeType,
            creationDto: unknown,
            companyId: string
        ): Promise<string | null> => {
            if (!autoSaveRef.current)
                return createDraftResource(
                    type,
                    creationDto,
                    labelForDraftResource(
                        type,
                        creationDto as Record<string, unknown>
                    ),
                    companyId
                )
            return recreateResource(type, creationDto, companyId)
        },
        [createDraftResource, labelForDraftResource, recreateResource]
    )

    // Retorna o id local otimista imediatamente (contrato síncrono já usado pelos chamadores
    // interativos, ex. conectar na sequência) e, à parte, `result` - promise que resolve o
    // sucesso/falha da criação de verdade. `applyHistoryAction` usa `result` pra saber se um
    // redo/undo de criação deu certo; os chamadores interativos seguem ignorando `result`.
    const createNode = useCallback(
        (
            type: CanvasNodeType,
            option: DestinationOption,
            position: { x: number; y: number }
        ): {
            localId: string
            result: Promise<{ ok: true; nodeId: string } | { ok: false }>
        } => {
            // auto save desligado: nunca some prefixo pending: (que sinaliza "em voo, resolve em
            // instantes") - draft-node: fica assim indefinidamente, só materializa de verdade no
            // clique de "Salvar" (ver saveDraft, que realiza cada entrada de draftNodeCreations na
            // ordem e substitui o id local pelo real em todo lugar que o referencia).
            const localId = !autoSaveRef.current
                ? `${DRAFT_NODE_PREFIX}${crypto.randomUUID()}`
                : `pending:${crypto.randomUUID()}`
            const now = new Date().toISOString()
            pendingNodeIds.current.add(localId)
            setFlowNodes((current) => [
                ...current,
                {
                    id: localId,
                    flowId: flow.id,
                    type,
                    resourceId: option.id,
                    label: option.label,
                    position,
                    createdAt: now,
                    updatedAt: now,
                } satisfies FlowNodeInstance,
            ])

            if (!autoSaveRef.current) {
                draftNodeCreations.current.set(localId, {
                    localId,
                    type,
                    resourceId: option.id,
                    label: option.label ?? null,
                    position,
                })
                markDraftDirty()
                return {
                    localId,
                    result: Promise.resolve({ ok: true, nodeId: localId }),
                }
            }

            const result = api
                .post(`/flows/${flow.id}/nodes`, {
                    type,
                    resourceId: option.id,
                    label: option.label,
                    position,
                })
                .then(({ data }) => {
                    const nodeId = data.nodeId as string
                    pendingNodeIds.current.delete(localId)
                    nodeIdMapRef.current.set(localId, nodeId)
                    setFlowNodes((current) =>
                        current.map((node) =>
                            node.id === localId ? { ...node, id: nodeId } : node
                        )
                    )
                    if (pendingPositions.current.has(localId)) {
                        const localPosition =
                            pendingPositions.current.get(localId)!
                        pendingPositions.current.delete(localId)
                        pendingPositions.current.set(nodeId, localPosition)
                        void clearPendingPosition(flow.id, localId)
                        void savePendingPosition(flow.id, nodeId, localPosition)
                    }
                    setFlowEdges((current) =>
                        current.map((edge) => ({
                            ...edge,
                            sourceNodeId:
                                edge.sourceNodeId === localId
                                    ? nodeId
                                    : edge.sourceNodeId,
                            targetNodeId:
                                edge.targetNodeId === localId
                                    ? nodeId
                                    : edge.targetNodeId,
                        }))
                    )
                    for (const [key, operation] of Array.from(
                        pendingEdgeOperations.current
                    )) {
                        const sourceNodeId =
                            operation.sourceNodeId === localId
                                ? nodeId
                                : operation.sourceNodeId
                        const targetNodeId =
                            operation.type === "connect" &&
                            operation.targetNodeId === localId
                                ? nodeId
                                : operation.type === "connect"
                                  ? operation.targetNodeId
                                  : null
                        if (
                            sourceNodeId === operation.sourceNodeId &&
                            targetNodeId ===
                                (operation.type === "connect"
                                    ? operation.targetNodeId
                                    : null)
                        )
                            continue
                        const next: EdgeOperation =
                            operation.type === "connect"
                                ? {
                                      ...operation,
                                      sourceNodeId,
                                      targetNodeId: targetNodeId!,
                                  }
                                : { ...operation, sourceNodeId }
                        const nextKey = `${next.sourceNodeId}:${next.sourcePort}`
                        pendingEdgeOperations.current.delete(key)
                        pendingEdgeOperations.current.set(nextKey, next)
                        void clearPendingEdgeOp(flow.id, key)
                        void savePendingEdgeOp(flow.id, nextKey, next)
                    }
                    scheduleEdgeSync(0)
                    if (saveTimer.current) clearTimeout(saveTimer.current)
                    saveTimer.current = setTimeout(
                        () => void persistPositions(),
                        0
                    )
                    return { ok: true as const, nodeId }
                })
                .catch(async (err) => {
                    pendingNodeIds.current.delete(localId)
                    // criação falhou - o nó nunca existiu no backend, então qualquer posição
                    // enfileirada pra ele (arraste rápido antes do erro) precisa sumir junto, senão
                    // persistPositions fica retentando PUT /nodes/pending:<uuid> pra sempre.
                    pendingPositions.current.delete(localId)
                    void clearPendingPosition(flow.id, localId)
                    for (const [
                        key,
                        operation,
                    ] of pendingEdgeOperations.current)
                        if (
                            operation.sourceNodeId === localId ||
                            (operation.type === "connect" &&
                                operation.targetNodeId === localId)
                        ) {
                            pendingEdgeOperations.current.delete(key)
                            void clearPendingEdgeOp(flow.id, key)
                        }
                    try {
                        const { data } = await api.get(
                            `/flows/${flow.id}/nodes`
                        )
                        setFlowNodes(data.nodes ?? [])
                        setFlowEdges(data.edges ?? [])
                    } catch {
                        setFlowNodes((current) =>
                            current.filter((node) => node.id !== localId)
                        )
                        setFlowEdges((current) =>
                            current.filter(
                                (edge) =>
                                    edge.sourceNodeId !== localId &&
                                    edge.targetNodeId !== localId
                            )
                        )
                    }
                    toast.error(apiError(err, "Erro ao adicionar nó"))
                    return { ok: false as const }
                })

            return { localId, result }
        },
        [
            flow.id,
            persistPositions,
            scheduleEdgeSync,
            setFlowEdges,
            setFlowNodes,
            markDraftDirty,
        ]
    )

    useEffect(() => {
        const nodes: Node[] = [
            {
                id: START_KEY,
                type: "startNode",
                position: startPosition,
                data: {},
                deletable: false,
            },
        ]
        for (const node of flowNodes) {
            const config = NODE_TYPE_CONFIG[node.type as CanvasNodeType]
            const ivr =
                node.type === "ivr" && node.resourceId
                    ? ivrById.get(node.resourceId)
                    : undefined
            const outgoing = flowEdges.filter(
                (edge) => edge.sourceNodeId === node.id
            )
            const slots = [
                ...new Set([
                    ...(config?.staticSlots ?? []),
                    ...(ivr
                        ? ivr.type === "collect"
                            ? ["long"]
                            : ivr.options.map(
                                  (option) => `digit:${option.digit}`
                              )
                        : []),
                    ...outgoing.map((edge) => edge.sourcePort),
                ]),
            ]
            const slotTargets: NonNullable<FlowNodeData["slotTargets"]> = {}
            for (const edge of outgoing) {
                const target = nodeById.get(edge.targetNodeId)
                if (target)
                    slotTargets[edge.sourcePort] = {
                        type: target.type,
                        id: target.resourceId ?? target.id,
                        name: target.label ?? target.resourceId ?? "Nó",
                    }
            }
            nodes.push({
                id: node.id,
                type: "flowNode",
                position: node.position,
                data: {
                    nodeType: node.type as FlowNodeData["nodeType"],
                    resourceId: node.resourceId,
                    actionLabel:
                        NODE_ACTION_LABELS[node.type as CanvasNodeType] ??
                        "Executar ação",
                    name:
                        ivr?.name ??
                        node.label ??
                        node.resourceId ??
                        "Nó sem recurso",
                    slots,
                    companyId: flow.companyId,
                    slotTargets,
                    onRemove: deleteNode,
                    onConnectSlot: async (slot, type, resourceId, label) => {
                        const source = nodeById.get(node.id)
                        if (!source) return
                        const position = {
                            x: node.position.x + 280,
                            y: node.position.y + 70,
                        }
                        const { localId } = createNode(
                            type,
                            { id: resourceId, label },
                            position
                        )
                        history.push({
                            kind: "create-node",
                            nodeId: localId,
                            type,
                            resourceId,
                            label: label ?? null,
                            position,
                        })
                        connectNodes(source.id, slot, localId)
                    },
                    onDisconnectSlot: async (slot) => {
                        const edge = outgoing.find(
                            (item) => item.sourcePort === slot
                        )
                        if (edge) await deleteEdge(edge.id)
                    },
                    onCreateSlot: (slot, type) =>
                        setPendingCreation({
                            type,
                            source: { nodeId: node.id, port: slot },
                        }),
                    onEdit: () => {
                        if (node.resourceId)
                            setEditingNode({
                                nodeId: node.id,
                                type: node.type as CanvasNodeType,
                                resourceId: node.resourceId,
                                name: node.label ?? node.resourceId,
                            })
                    },
                } satisfies FlowNodeData as any,
            })
        }

        const edges: Edge[] = flowEdges.map((edge) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            sourceHandle: edge.sourcePort,
            target: edge.targetNodeId,
            type: "deletable",
            style: edgeStyleForSlot(edge.sourcePort),
            data: {
                onDelete: () => deleteEdge(edge.id),
            } satisfies DeletableEdgeData,
        }))
        if (entryNodeId)
            edges.push({
                id: `start-${entryNodeId}`,
                source: START_KEY,
                sourceHandle: "entry",
                target: entryNodeId,
                type: "deletable",
                style: edgeStyleForSlot("entry"),
                data: {
                    onDelete: () => clearEntry(entryNodeId),
                } satisfies DeletableEdgeData,
            })
        setRfNodes(nodes)
        setRfEdges(edges)
    }, [
        flowNodes,
        flowEdges,
        entryNodeId,
        flow.companyId,
        startPosition,
        nodeById,
        createNode,
        connectNodes,
        deleteEdge,
        deleteNode,
        clearEntry,
        history,
        ivrById,
    ])

    // Aplica e persiste a posição de um nó comum, com o mesmo debounce/pending-queue de sempre -
    // reaproveitado tanto pelo settle do arraste interativo (onNodesChange abaixo) quanto pelo
    // replay de undo/redo (applyHistoryAction), que chama com flushDelay:0 (ação explícita do
    // usuário, sem motivo pra esperar mais 450ms). Só registra histórico (move-node) quando a
    // posição de fato muda, e nunca durante o replay (history.push já é no-op nesse caso).
    const commitNodePosition = useCallback(
        (
            nodeId: string,
            position: { x: number; y: number },
            flushDelay = 450,
            recordHistory = true
        ) => {
            const previous = flowNodesRef.current.find(
                (node) => node.id === nodeId
            )?.position
            setFlowNodes((current) =>
                current.map((node) =>
                    node.id === nodeId ? { ...node, position } : node
                )
            )
            pendingPositions.current.set(nodeId, position)
            void savePendingPosition(flow.id, nodeId, position)
            // auto save desligado: a posição já está em IndexedDB (linha acima) - não agenda o PUT.
            // saveDraft chama persistPositions() direto pra despejar tudo de uma vez no "Salvar".
            if (autoSaveRef.current) {
                if (saveTimer.current) clearTimeout(saveTimer.current)
                saveTimer.current = setTimeout(
                    () => void persistPositions(),
                    flushDelay
                )
            } else markDraftDirty()
            if (
                recordHistory &&
                previous &&
                (previous.x !== position.x || previous.y !== position.y)
            )
                history.push({
                    kind: "move-node",
                    nodeId,
                    from: previous,
                    to: position,
                })
        },
        [flow.id, persistPositions, setFlowNodes, history, markDraftDirty]
    )

    // Idem, pro nó sintético Início (posição guardada à parte, ver comentário de startPosition
    // acima) - mesmo padrão de flushDelay/push de histórico.
    const commitStartPosition = useCallback(
        (
            position: { x: number; y: number },
            flushDelay = 450,
            recordHistory = true
        ) => {
            setStartPosition((previous) => {
                if (
                    recordHistory &&
                    (previous.x !== position.x || previous.y !== position.y)
                )
                    history.push({
                        kind: "move-start",
                        from: previous,
                        to: position,
                    })
                return position
            })
            if (!autoSaveRef.current) {
                draftStart.current = { dirty: true, position }
                markDraftDirty()
                return
            }
            if (startSaveTimer.current) clearTimeout(startSaveTimer.current)
            startSaveTimer.current = setTimeout(() => {
                void api
                    .put(`/flows/${flow.id}/layout`, {
                        layout: [
                            {
                                nodeType: "start",
                                nodeId: START_KEY,
                                x: position.x,
                                y: position.y,
                            },
                        ],
                    })
                    .catch((err) => {
                        toast.error(
                            apiError(
                                err,
                                "Erro ao salvar posição do início do flow"
                            )
                        )
                    })
            }, flushDelay)
        },
        [flow.id, history, markDraftDirty]
    )

    // Auto-layout (ELK, algoritmo "layered"): recalcula a posição de todos os nós a partir das
    // conexões, sem mexer em quem-liga-com-quem. Usa as dimensões já medidas pelo React Flow
    // (node.measured) - nó recém-criado ainda sem medição cai no tamanho padrão do card. Persiste
    // como um replay (flushDelay:0) e sem gerar histórico por nó (senão um layout de 20 nós vira
    // 20 undos); o fitView só roda depois de dois rAF pra garantir que o novo rfNodes já pintou.
    const handleAutoLayout = useCallback(async () => {
        const instance = flowInstanceRef.current
        if (!instance) return
        const nodes = instance.getNodes()
        const edges = instance.getEdges()
        if (nodes.length === 0) return

        let graph
        try {
            const elk = await getElk()
            graph = await elk.layout({
                id: "root",
                layoutOptions: AUTO_LAYOUT_OPTIONS,
                children: nodes.map((node) => ({
                    id: node.id,
                    width:
                        node.measured?.width ?? AUTO_LAYOUT_DEFAULT_SIZE.width,
                    height:
                        node.measured?.height ??
                        AUTO_LAYOUT_DEFAULT_SIZE.height,
                })),
                edges: edges.map((edge) => ({
                    id: edge.id,
                    sources: [edge.source],
                    targets: [edge.target],
                })),
            })
        } catch {
            toast.error("Erro ao calcular o reposicionamento automático")
            return
        }

        for (const child of graph.children ?? []) {
            const position = { x: child.x ?? 0, y: child.y ?? 0 }
            if (child.id === START_KEY) commitStartPosition(position, 0, false)
            else commitNodePosition(child.id, position, 0, false)
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                flowInstanceRef.current?.fitView({
                    padding: 0.2,
                    duration: 400,
                })
            })
        })
    }, [commitNodePosition, commitStartPosition])

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setRfNodes((current) => applyNodeChanges(changes, current))
            // dragging=true dispara em toda posição intermediária do arraste - só commitamos em
            // flowNodes (o que retrigger o rebuild do canvas inteiro) quando o gesto termina, senão
            // pisca a cada frame brigando com a própria animação do React Flow.
            const settled = changes.filter(
                (change): change is Extract<NodeChange, { type: "position" }> =>
                    change.type === "position" &&
                    !!change.position &&
                    change.id !== START_KEY &&
                    change.dragging !== true
            )
            for (const change of settled)
                commitNodePosition(change.id, change.position!, 450)

            const startChange = changes.find(
                (change): change is Extract<NodeChange, { type: "position" }> =>
                    change.type === "position" &&
                    !!change.position &&
                    change.id === START_KEY &&
                    change.dragging !== true
            )
            if (startChange) commitStartPosition(startChange.position!, 450)
        },
        [commitNodePosition, commitStartPosition]
    )

    // Sem isso, clicar numa aresta pra selecioná-la não tinha efeito nenhum: o array `edges` é
    // controlado (vem de `rfEdges`), e sem `onEdgesChange` o React Flow não tem como persistir a
    // mudança de seleção nele - no próximo render o próprio prop (sem `selected`) sobrescrevia de
    // volta o estado interno da lib, então nem o destaque visual nem o Backspace/Delete (que só
    // olha pras arestas marcadas `selected`) funcionavam. Mesmo padrão de onNodesChange acima.
    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        setRfEdges((current) => applyEdgeChanges(changes, current))
    }, [])

    // Executor central do histórico - traduz uma HistoryAction em undo/redo replaying os mesmos
    // comandos usados interativamente (por isso nenhum deles registra histórico de novo: history.push
    // é no-op enquanto useFlowHistory está processando undo/redo). Rejeita (lança) só quando o
    // comando de fato falhou no backend - aí useFlowHistory devolve a ação pra pilha de origem, sem
    // mexer na pilha oposta (ver flow-history.ts). resolveNodeId sempre traduz um id histórico pro
    // id vivo atual, mesmo depois de vários ciclos de recriação (ver nodeIdMapRef).
    const applyHistoryAction = useCallback(
        async (action: HistoryAction, direction: HistoryDirection) => {
            switch (action.kind) {
                case "move-node": {
                    const nodeId = resolveNodeId(action.nodeId)
                    commitNodePosition(
                        nodeId,
                        direction === "undo" ? action.from : action.to,
                        0
                    )
                    return
                }
                case "move-start": {
                    commitStartPosition(
                        direction === "undo" ? action.from : action.to,
                        0
                    )
                    return
                }
                case "connect-edge": {
                    const sourceNodeId = resolveNodeId(action.sourceNodeId)
                    const targetNodeId = resolveNodeId(action.targetNodeId)
                    if (direction === "undo") {
                        if (action.previousTargetNodeId)
                            connectNodes(
                                sourceNodeId,
                                action.sourcePort,
                                resolveNodeId(action.previousTargetNodeId)
                            )
                        else disconnectNodes(sourceNodeId, action.sourcePort)
                    } else {
                        connectNodes(
                            sourceNodeId,
                            action.sourcePort,
                            targetNodeId
                        )
                    }
                    return
                }
                case "disconnect-edge": {
                    const sourceNodeId = resolveNodeId(action.sourceNodeId)
                    const targetNodeId = resolveNodeId(action.targetNodeId)
                    if (direction === "undo")
                        connectNodes(
                            sourceNodeId,
                            action.sourcePort,
                            targetNodeId
                        )
                    else disconnectNodes(sourceNodeId, action.sourcePort)
                    return
                }
                case "change-entry": {
                    const from = action.from ? resolveNodeId(action.from) : null
                    const to = action.to ? resolveNodeId(action.to) : null
                    const ok =
                        direction === "undo"
                            ? from
                                ? await setEntry(from)
                                : await clearEntry(to!)
                            : to
                              ? await setEntry(to)
                              : await clearEntry(from!)
                    if (!ok) throw new Error("change-entry failed")
                    return
                }
                case "create-node": {
                    if (direction === "undo") {
                        const nodeId = resolveNodeId(action.nodeId)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteNodeCore(nodeId)
                        if (!ok) throw new Error("undo create-node failed")
                    } else {
                        const created = await createNode(
                            action.type,
                            {
                                id: action.resourceId,
                                label: action.label ?? action.resourceId,
                            },
                            action.position
                        ).result
                        if (!created.ok)
                            throw new Error("redo create-node failed")
                        nodeIdMapRef.current.set(action.nodeId, created.nodeId)
                        action.nodeId = created.nodeId
                    }
                    return
                }
                case "create-resource-node": {
                    if (direction === "undo") {
                        const nodeId = resolveNodeId(action.nodeId)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteResourceCore({
                            nodeId,
                            type: action.resourceType,
                            resourceId: action.resourceId,
                        })
                        if (!ok)
                            throw new Error("undo create-resource-node failed")
                    } else {
                        const resourceId = await recreateResourceDraftAware(
                            action.resourceType,
                            action.creationDto,
                            flow.companyId
                        )
                        if (!resourceId)
                            throw new Error(
                                "redo create-resource-node failed: resource"
                            )
                        const created = await createNode(
                            action.resourceType,
                            {
                                id: resourceId,
                                label: action.label ?? resourceId,
                            },
                            action.position
                        ).result
                        if (!created.ok)
                            throw new Error(
                                "redo create-resource-node failed: node"
                            )
                        nodeIdMapRef.current.set(action.nodeId, created.nodeId)
                        action.nodeId = created.nodeId
                        action.resourceId = resourceId
                    }
                    return
                }
                case "delete-node": {
                    if (direction === "undo") {
                        const created = await createNode(
                            action.node.type as CanvasNodeType,
                            {
                                id: action.node.resourceId!,
                                label:
                                    action.node.label ??
                                    action.node.resourceId ??
                                    "Nó",
                            },
                            action.node.position
                        ).result
                        if (!created.ok)
                            throw new Error("undo delete-node failed")
                        nodeIdMapRef.current.set(action.node.id, created.nodeId)
                        action.node = { ...action.node, id: created.nodeId }
                        for (const edge of [
                            ...action.incomingEdges,
                            ...action.outgoingEdges,
                        ])
                            connectNodes(
                                resolveNodeId(edge.sourceNodeId),
                                edge.sourcePort,
                                resolveNodeId(edge.targetNodeId)
                            )
                        if (action.wasEntry) {
                            const ok = await setEntry(created.nodeId)
                            if (!ok)
                                throw new Error(
                                    "undo delete-node entry restore failed"
                                )
                        }
                    } else {
                        const nodeId = resolveNodeId(action.node.id)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteNodeCore(nodeId)
                        if (!ok) throw new Error("redo delete-node failed")
                    }
                    return
                }
                case "delete-resource": {
                    if (direction === "undo") {
                        const resourceId = await recreateResourceDraftAware(
                            action.resourceType,
                            action.creationDto,
                            flow.companyId
                        )
                        if (!resourceId)
                            throw new Error(
                                "undo delete-resource failed: resource"
                            )
                        const created = await createNode(
                            action.resourceType,
                            {
                                id: resourceId,
                                label:
                                    action.node.label ??
                                    action.node.resourceId ??
                                    "Nó",
                            },
                            action.node.position
                        ).result
                        if (!created.ok)
                            throw new Error("undo delete-resource failed: node")
                        nodeIdMapRef.current.set(action.node.id, created.nodeId)
                        action.node = {
                            ...action.node,
                            id: created.nodeId,
                            resourceId,
                        }
                        for (const edge of [
                            ...action.incomingEdges,
                            ...action.outgoingEdges,
                        ])
                            connectNodes(
                                resolveNodeId(edge.sourceNodeId),
                                edge.sourcePort,
                                resolveNodeId(edge.targetNodeId)
                            )
                        if (action.wasEntry) {
                            const ok = await setEntry(created.nodeId)
                            if (!ok)
                                throw new Error(
                                    "undo delete-resource entry restore failed"
                                )
                        }
                    } else {
                        const nodeId = resolveNodeId(action.node.id)
                        removeNodeFromCanvas(nodeId)
                        const ok = await deleteResourceCore({
                            nodeId,
                            type: action.resourceType,
                            resourceId: action.node.resourceId!,
                        })
                        if (!ok) throw new Error("redo delete-resource failed")
                    }
                    return
                }
            }
        },
        [
            resolveNodeId,
            commitNodePosition,
            commitStartPosition,
            connectNodes,
            disconnectNodes,
            setEntry,
            clearEntry,
            removeNodeFromCanvas,
            deleteNodeCore,
            deleteResourceCore,
            createNode,
            recreateResourceDraftAware,
            flow.companyId,
        ]
    )

    // Aplica de verdade a edição de um recurso que já existia antes deste draft - contraparte de
    // recreateResource, usada só por saveDraft (auto save ligado nunca passa por aqui, o form já
    // chama updateXxx direto, ver edit-node-dialog.tsx).
    const updateResourceGeneric = useCallback(
        async (
            type: CanvasNodeType,
            resourceId: string,
            form: unknown
        ): Promise<boolean> => {
            switch (type) {
                case "announcement":
                    return updateAnnouncement(
                        resourceId,
                        form as AnnouncementForm
                    )
                case "queue":
                    return updateQueue(resourceId, form as QueueUpdateForm)
                case "request":
                    return updateRequestTemplate(
                        resourceId,
                        form as RequestTemplateUpdateForm
                    )
                case "ixc":
                    return updateIxcNode(
                        resourceId,
                        form as IxcNodeUpdateForm
                    )
                case "formatter":
                    return updateFormatterNode(
                        resourceId,
                        form as FormatterNodeUpdateForm
                    )
                case "timecondition":
                    return updateTimeCondition(
                        resourceId,
                        form as TimeConditionForm
                    )
                case "holiday":
                    return updateHolidayGroup(
                        resourceId,
                        form as HolidayGroupUpdateForm
                    )
                case "variable-set":
                    return updateVariableSet(
                        resourceId,
                        form as VariableSetUpdateForm
                    )
                case "variable-condition":
                    return updateVariableCondition(
                        resourceId,
                        form as VariableConditionUpdateForm
                    )
                case "ivr":
                    return updateIvrMenu(resourceId, form as IvrMenuForm)
                case "extension":
                    return updateExtension(
                        resourceId,
                        form as ExtensionUpdateForm
                    )
                case "flow":
                    return updateFlow(resourceId, form as { name: string })
            }
        },
        [
            updateAnnouncement,
            updateQueue,
            updateRequestTemplate,
            updateIxcNode,
            updateFormatterNode,
            updateTimeCondition,
            updateHolidayGroup,
            updateVariableSet,
            updateVariableCondition,
            updateIvrMenu,
            updateExtension,
            updateFlow,
        ]
    )

    // Editar um recurso no EditNodeDialog com auto save desligado (ou editar um recurso que ainda é
    // só rascunho, com auto save em qualquer estado) nunca chama a API - só reescreve o rascunho e
    // reflete o novo nome no card na hora, sem esperar o "Salvar".
    const applyDraftResourceEdit = useCallback(
        (type: CanvasNodeType, resourceId: string, form: unknown) => {
            const label = labelForDraftResource(
                type,
                form as Record<string, unknown>
            )
            const existing = draftResourceCreations.current.get(resourceId)
            if (existing)
                draftResourceCreations.current.set(resourceId, {
                    ...existing,
                    form,
                    label,
                })
            else draftResourceUpdates.current.set(resourceId, { resourceId, type, form })
            setFlowNodes((current) =>
                current.map((node) =>
                    node.resourceId === resourceId ? { ...node, label } : node
                )
            )
            markDraftDirty()
        },
        [labelForDraftResource, markDraftDirty, setFlowNodes]
    )

    // Aplica de verdade tudo que ficou pendente no draft, na ordem: recursos+nós criados, exclusões
    // de recurso, exclusões de nó, edições de recurso, conexões, posições, entrada do flow e posição
    // do "Início". Para no primeiro erro (toast + return), deixando o restante pendente pro próximo
    // clique em "Salvar" - nunca limpa o draft parcialmente. Reaproveita as mesmas rotas/funções do
    // caminho online (recreateResource, flushEdgeOperations, persistPositions).
    const saveDraft = useCallback(async () => {
        if (isSavingDraft) return
        const hasPending =
            draftNodeCreations.current.size > 0 ||
            draftResourceDeletions.current.size > 0 ||
            draftNodeDeletions.current.size > 0 ||
            draftResourceUpdates.current.size > 0 ||
            draftEntry.current.dirty ||
            draftStart.current.dirty ||
            pendingPositions.current.size > 0 ||
            pendingEdgeOperations.current.size > 0
        if (!hasPending) return
        setIsSavingDraft(true)
        try {
            // 1) materializa recurso+nó de cada criação feita neste draft, na ordem em que ocorreram
            for (const creation of [...draftNodeCreations.current.values()]) {
                let resourceId = creation.resourceId
                if (resourceId.startsWith(DRAFT_RES_PREFIX)) {
                    const draftResource = draftResourceCreations.current.get(
                        resourceId
                    )
                    if (!draftResource) continue
                    const realResourceId = await recreateResource(
                        draftResource.type,
                        draftResource.form,
                        draftResource.companyId
                    )
                    if (!realResourceId) {
                        toast.error(
                            `Erro ao criar "${draftResource.label}" - o restante fica pendente`
                        )
                        return
                    }
                    draftResourceCreations.current.delete(resourceId)
                    resourceId = realResourceId
                }
                let nodeId: string
                try {
                    const { data } = await api.post(
                        `/flows/${flow.id}/nodes`,
                        {
                            type: creation.type,
                            resourceId,
                            label: creation.label,
                            position: creation.position,
                        }
                    )
                    nodeId = data.nodeId as string
                } catch (err) {
                    toast.error(
                        apiError(
                            err,
                            `Erro ao criar nó "${creation.label ?? creation.type}" - o restante fica pendente`
                        )
                    )
                    return
                }
                const localId = creation.localId
                draftNodeCreations.current.delete(localId)
                pendingNodeIds.current.delete(localId)
                nodeIdMapRef.current.set(localId, nodeId)
                setFlowNodes((current) =>
                    current.map((node) =>
                        node.id === localId
                            ? { ...node, id: nodeId, resourceId }
                            : node
                    )
                )
                setFlowEdges((current) =>
                    current.map((edge) => ({
                        ...edge,
                        sourceNodeId:
                            edge.sourceNodeId === localId
                                ? nodeId
                                : edge.sourceNodeId,
                        targetNodeId:
                            edge.targetNodeId === localId
                                ? nodeId
                                : edge.targetNodeId,
                    }))
                )
                for (const [key, operation] of Array.from(
                    pendingEdgeOperations.current
                )) {
                    const sourceNodeId =
                        operation.sourceNodeId === localId
                            ? nodeId
                            : operation.sourceNodeId
                    const targetNodeId =
                        operation.type === "connect" &&
                        operation.targetNodeId === localId
                            ? nodeId
                            : operation.type === "connect"
                              ? operation.targetNodeId
                              : null
                    if (
                        sourceNodeId === operation.sourceNodeId &&
                        targetNodeId ===
                            (operation.type === "connect"
                                ? operation.targetNodeId
                                : null)
                    )
                        continue
                    const next: EdgeOperation =
                        operation.type === "connect"
                            ? { ...operation, sourceNodeId, targetNodeId: targetNodeId! }
                            : { ...operation, sourceNodeId }
                    const nextKey = `${next.sourceNodeId}:${next.sourcePort}`
                    pendingEdgeOperations.current.delete(key)
                    pendingEdgeOperations.current.set(nextKey, next)
                    void clearPendingEdgeOp(flow.id, key)
                    void savePendingEdgeOp(flow.id, nextKey, next)
                }
                if (pendingPositions.current.has(localId)) {
                    const localPosition = pendingPositions.current.get(localId)!
                    pendingPositions.current.delete(localId)
                    pendingPositions.current.set(nodeId, localPosition)
                    void clearPendingPosition(flow.id, localId)
                    void savePendingPosition(flow.id, nodeId, localPosition)
                }
                if (draftEntry.current.nodeId === localId)
                    draftEntry.current.nodeId = nodeId
            }

            // 2) exclusões de recurso (nó junto, se ele chegou a existir de verdade no backend)
            for (const deletion of [...draftResourceDeletions.current.values()]) {
                const nodeId = resolveNodeId(deletion.nodeId)
                const nodeIsReal =
                    !nodeId.startsWith(DRAFT_NODE_PREFIX) &&
                    !nodeId.startsWith("pending:")
                try {
                    if (nodeIsReal) {
                        await api.post(
                            `/flows/${flow.id}/nodes/${nodeId}/resource-deletion-check`
                        )
                        await api.delete(`/flows/${flow.id}/nodes/${nodeId}`)
                    }
                    await api.delete(
                        `/${NODE_TYPE_CONFIG[deletion.type].apiPath}/${deletion.resourceId}`
                    )
                } catch (err) {
                    toast.error(
                        apiError(
                            err,
                            "Erro ao excluir recurso - o restante fica pendente"
                        )
                    )
                    return
                }
                draftResourceDeletions.current.delete(deletion.nodeId)
            }

            // 3) exclusões de nó "puro" (sem exclusão de recurso, ex. extension/flow desconectados)
            for (const nodeId of [...draftNodeDeletions.current]) {
                const realId = resolveNodeId(nodeId)
                try {
                    await api.delete(`/flows/${flow.id}/nodes/${realId}`)
                } catch (err) {
                    toast.error(
                        apiError(
                            err,
                            "Erro ao excluir nó - o restante fica pendente"
                        )
                    )
                    return
                }
                draftNodeDeletions.current.delete(nodeId)
            }

            // 4) edição de recurso que já existia antes deste draft
            for (const update of [...draftResourceUpdates.current.values()]) {
                const ok = await updateResourceGeneric(
                    update.type,
                    update.resourceId,
                    update.form
                )
                if (!ok) {
                    toast.error(
                        "Erro ao salvar edição de recurso - o restante fica pendente"
                    )
                    return
                }
                draftResourceUpdates.current.delete(update.resourceId)
            }

            // 5) conexões pendentes (connect/disconnect) - flush direto, sem depender do agendamento
            // normal (scheduleEdgeSync não dispara com auto save desligado, ver definição acima)
            await flushEdgeOperations()

            // 6) posições de nó pendentes
            await persistPositions()

            // 7) entrada do flow (último set/clear feito neste draft)
            if (draftEntry.current.dirty && draftEntry.current.nodeId) {
                const targetId = resolveNodeId(draftEntry.current.nodeId)
                try {
                    await api.put(`/flows/${flow.id}/nodes/${targetId}`, {
                        isEntry: draftEntry.current.isEntry,
                    })
                } catch (err) {
                    toast.error(
                        apiError(
                            err,
                            "Erro ao salvar início do flow - o restante fica pendente"
                        )
                    )
                    return
                }
                draftEntry.current = { dirty: false, nodeId: null, isEntry: true }
            }

            // 8) posição do nó sintético "Início"
            if (draftStart.current.dirty && draftStart.current.position) {
                try {
                    await api.put(`/flows/${flow.id}/layout`, {
                        layout: [
                            {
                                nodeType: "start",
                                nodeId: START_KEY,
                                x: draftStart.current.position.x,
                                y: draftStart.current.position.y,
                            },
                        ],
                    })
                } catch (err) {
                    toast.error(
                        apiError(
                            err,
                            "Erro ao salvar posição do início do flow - o restante fica pendente"
                        )
                    )
                    return
                }
                draftStart.current = { dirty: false, position: null }
            }

            await clearFlowDraft(flow.id)
            markDraftDirty()
            toast.success("Alterações salvas")
            try {
                await reconcileNodes()
            } catch {
                // O próximo carregamento busca o estado autoritativo.
            }
        } finally {
            setIsSavingDraft(false)
        }
    }, [
        isSavingDraft,
        flow.id,
        recreateResource,
        resolveNodeId,
        flushEdgeOperations,
        persistPositions,
        updateResourceGeneric,
        reconcileNodes,
        markDraftDirty,
        setFlowNodes,
        setFlowEdges,
    ])

    // joga fora o estado local/IndexedDB e volta a mostrar o que já está salvo. Confirmação fica na
    // UI (AlertDialog abaixo), não aqui - essa função só executa quando já foi confirmado.
    const discardDraft = useCallback(async () => {
        if (isDiscardingDraft) return
        setIsDiscardingDraft(true)
        try {
            // cancela qualquer flush/retry agendado - nada deve escrever no backend depois do
            // descarte, mesmo que um timer de debounce ainda estivesse de pé
            if (saveTimer.current) clearTimeout(saveTimer.current)
            if (edgeSyncTimer.current) clearTimeout(edgeSyncTimer.current)
            if (startSaveTimer.current) clearTimeout(startSaveTimer.current)
            if (draftPersistTimer.current) clearTimeout(draftPersistTimer.current)

            draftNodeCreations.current.clear()
            draftResourceCreations.current.clear()
            draftResourceUpdates.current.clear()
            draftResourceDeletions.current.clear()
            draftNodeDeletions.current.clear()
            draftEntry.current = { dirty: false, nodeId: null, isEntry: true }
            draftStart.current = { dirty: false, position: null }
            pendingPositions.current.clear()
            pendingEdgeOperations.current.clear()
            pendingNodeIds.current.clear()
            // ids remapeados (undo/redo) e o próprio histórico não fazem mais sentido depois de
            // voltar ao estado salvo - um undo de uma ação já descartada só quebraria de novo.
            nodeIdMapRef.current.clear()
            history.clear()

            await Promise.all([
                clearFlowDraft(flow.id),
                clearAllPendingForFlow(flow.id),
            ])

            const savedStart = flow.layout?.find(
                (item) => item.nodeId === START_KEY
            )
            setStartPosition(
                savedStart ? { x: savedStart.x, y: savedStart.y } : { x: 80, y: 40 }
            )
            markDraftDirty()
            try {
                await reconcileNodes()
            } catch {
                // O próximo carregamento busca o estado autoritativo.
            }
            toast.success("Alterações descartadas")
        } finally {
            setIsDiscardingDraft(false)
        }
    }, [isDiscardingDraft, flow.id, flow.layout, history, reconcileNodes, markDraftDirty])

    // Alterna auto save - ligar de novo com alterações pendentes dispara o "Salvar" automaticamente
    // (evita ficar num estado híbrido "toggle ligado mas ainda tem coisa só local").
    const handleToggleAutoSave = useCallback(
        (checked: boolean) => {
            autoSaveRef.current = checked
            setAutoSaveState(checked)
            localStorage.setItem(
                autoSaveStorageKey(flow.id),
                checked ? "on" : "off"
            )
            if (checked) void saveDraft()
        },
        [flow.id, saveDraft]
    )

    useEffect(() => {
        history.setApplyAction(applyHistoryAction)
    }, [applyHistoryAction, history])

    // Atalhos de undo/redo - só quando o foco está no canvas (ou em lugar nenhum, caso comum logo
    // após abrir a página e nunca ter clicado num input). Diálogos (base-ui) fazem portal fora da
    // subárvore de canvasRootRef, então o teste de containment já basta pra nunca disparar com um
    // diálogo aberto; o teste de input/textarea/contentEditable é defesa extra caso um campo de
    // texto passe a existir dentro do canvas no futuro. preventDefault só roda depois dos guards,
    // então o desfazer nativo de texto (em qualquer lugar fora do canvas) nunca é tocado.
    useEffect(() => {
        function isEditableTarget(target: EventTarget | null) {
            if (!(target instanceof HTMLElement)) return false
            if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
                return true
            return target.isContentEditable
        }
        function onKeyDown(event: KeyboardEvent) {
            const key = event.key.toLowerCase()
            const isMod = event.ctrlKey || event.metaKey
            if (!isMod || (key !== "z" && key !== "y")) return
            const withinCanvas =
                canvasRootRef.current?.contains(
                    event.target as globalThis.Node
                ) ?? false
            const noFocusElsewhere =
                document.activeElement === document.body ||
                document.activeElement === null
            if (!withinCanvas && !noFocusElsewhere) return
            if (isEditableTarget(event.target)) return
            if (key === "z" && event.shiftKey) {
                event.preventDefault()
                history.redo()
            } else if (key === "z") {
                event.preventDefault()
                history.undo()
            } else if (key === "y") {
                event.preventDefault()
                history.redo()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [history])

    // Leitura pontual do IndexedDB (posições/edges pendentes + draft de auto save desligado) via
    // useQuery em vez de useEffect+fetch manual: o dedupe de promise em voo do TanStack Query já
    // resolve certo o duplo-invoke do StrictMode (dev) sem precisar de flag "cancelled" nenhuma -
    // era exatamente essa flag, fechada no closure do useEffect antigo, que causava um bug real
    // (nó criado com auto save desligado sumia do card "N alterações pendentes" ao trocar de
    // página e voltar: o cleanup da 1ª invocação do StrictMode marcava cancelled=true antes da
    // promise resolver, e a 2ª invocação nem tentava de novo por causa do hydratedFlowRef abaixo).
    // gcTime:0 pra nunca servir um resultado cacheado de uma montagem anterior deste MESMO flow.id
    // - a montagem anterior pode ter gravado no IndexedDB um flush de unmount depois que este
    // query rodou; sem isso, reabrir o flow serviria o draft de antes desse flush.
    const draftHydrationQuery = useQuery({
        queryKey: ["flow-draft-hydration", flow.id],
        queryFn: () =>
            Promise.all([loadPendingForFlow(flow.id), loadFlowDraft(flow.id)]),
        enabled: !!flow.id && !loading,
        staleTime: Infinity,
        gcTime: 0,
    })

    useEffect(() => {
        if (!draftHydrationQuery.data) return
        if (hydratedFlowRef.current === flow.id) return
        hydratedFlowRef.current = flow.id
        // Corpo síncrono agora (dado já resolvido pelo useQuery acima) - sem promise em voo, sem
        // race de StrictMode possível: essa aplicação roda de uma vez só, na mesma invocação do
        // effect que passou no guard de hydratedFlowRef.
        const [{ positions, edgeOps }, draft] = draftHydrationQuery.data

        // Rehidrata o draft (auto save desligado numa sessão anterior, aba fechada/recarregada
        // antes de clicar em "Salvar") ANTES de calcular knownNodeIds - nó criado só no draft
        // precisa contar como "conhecido" pra posição/edge dele (abaixo) não ser descartada como
        // órfã, e nó/recurso marcado pra exclusão precisa sumir da base antes de tudo o resto.
        if (draft) {
            for (const creation of draft.resourceCreations)
                draftResourceCreations.current.set(creation.draftId, creation)
            for (const update of draft.resourceUpdates)
                draftResourceUpdates.current.set(update.resourceId, update)
            for (const deletion of draft.resourceDeletions)
                draftResourceDeletions.current.set(deletion.nodeId, deletion)
            for (const nodeId of draft.nodeDeletions)
                draftNodeDeletions.current.add(nodeId)
            if (draft.entryDirty)
                draftEntry.current = {
                    dirty: true,
                    nodeId: draft.entryNodeId,
                    isEntry: draft.entryIsEntry,
                }
            if (draft.startDirty && draft.startPosition) {
                draftStart.current = {
                    dirty: true,
                    position: draft.startPosition,
                }
                setStartPosition(draft.startPosition)
            }
            const removedNodeIds = new Set([
                ...draft.resourceDeletions.map((d) => d.nodeId),
                ...draft.nodeDeletions,
            ])
            const now = new Date().toISOString()
            setFlowNodes((current) => [
                ...current
                    .filter((node) => !removedNodeIds.has(node.id))
                    // reflete no card o rename/edição de um recurso que já existia antes deste
                    // draft (draftResourceUpdates acima) - sem isso o card volta a mostrar o
                    // nome antigo até o usuário abrir o EditNodeDialog de novo, mesmo com o
                    // rascunho certo já marcado como pendente.
                    .map((node) => {
                        const update = draft.resourceUpdates.find(
                            (u) => u.resourceId === node.resourceId
                        )
                        return update
                            ? {
                                  ...node,
                                  label: labelForDraftResource(
                                      update.type,
                                      update.form as Record<string, unknown>
                                  ),
                              }
                            : node
                    }),
                ...draft.nodeCreations.map(
                    (creation): FlowNodeInstance => ({
                        id: creation.localId,
                        flowId: flow.id,
                        type: creation.type,
                        resourceId: creation.resourceId,
                        label: creation.label,
                        position: creation.position,
                        createdAt: now,
                        updatedAt: now,
                    })
                ),
            ])
            setFlowEdges((current) =>
                current.filter(
                    (edge) =>
                        !removedNodeIds.has(edge.sourceNodeId) &&
                        !removedNodeIds.has(edge.targetNodeId)
                )
            )
            if (draft.entryDirty)
                setEntryNodeId(draft.entryIsEntry ? draft.entryNodeId : null)
            for (const creation of draft.nodeCreations) {
                pendingNodeIds.current.add(creation.localId)
                draftNodeCreations.current.set(creation.localId, creation)
            }
            if (isDraftDirty(draft)) markDraftDirty()
        }

        const knownNodeIds = new Set([
            START_KEY,
            ...flowNodes.map((node) => node.id),
            ...(draft?.nodeCreations.map((c) => c.localId) ?? []),
        ])
        let hasPositions = false
        for (const [nodeId, position] of positions) {
            if (!knownNodeIds.has(nodeId)) {
                void clearPendingPosition(flow.id, nodeId)
                continue
            }
            pendingPositions.current.set(nodeId, position)
            hasPositions = true
        }
        if (hasPositions) {
            setFlowNodes((current) =>
                current.map((node) =>
                    pendingPositions.current.has(node.id)
                        ? {
                              ...node,
                              position: pendingPositions.current.get(
                                  node.id
                              )!,
                          }
                        : node
                )
            )
            // só reenvia pro backend sozinho se auto save está ligado - com ele desligado, a posição
            // fica só no draft até o usuário clicar em "Salvar" (senão reabrir o flow já dispara um
            // PUT que o auto save desligado deveria estar evitando).
            if (autoSaveRef.current) {
                if (saveTimer.current) clearTimeout(saveTimer.current)
                saveTimer.current = setTimeout(() => void persistPositions(), 0)
            }
        }

        let hasEdgeOps = false
        for (const [key, operation] of edgeOps) {
            const sourceKnown = knownNodeIds.has(operation.sourceNodeId)
            const targetKnown =
                operation.type === "disconnect" ||
                knownNodeIds.has(operation.targetNodeId)
            if (!sourceKnown || !targetKnown) {
                void clearPendingEdgeOp(flow.id, key)
                continue
            }
            pendingEdgeOperations.current.set(key, operation)
            hasEdgeOps = true
        }
        if (hasEdgeOps) {
            setFlowEdges((current) =>
                applyEdgeOperations(
                    current,
                    pendingEdgeOperations.current.values()
                )
            )
            scheduleEdgeSync(0)
        }
        // posição/edge pendente restaurada do IndexedDB também conta pro badge/botão de "Salvar" -
        // sem isso, o ref ficava povoado (e persistia certinho) mas draftVersion nunca bumpava, então
        // o botão reabria cinza mesmo com alteração pendente de verdade (draftDirtyCount não
        // recalculava por não estar nos deps do useMemo).
        if (!autoSaveRef.current && (hasPositions || hasEdgeOps)) markDraftDirty()
    }, [
        flow.id,
        draftHydrationQuery.data,
        flowNodes,
        persistPositions,
        scheduleEdgeSync,
        setFlowEdges,
        setFlowNodes,
        setEntryNodeId,
        markDraftDirty,
        labelForDraftResource,
    ])

    const onConnect = useCallback(
        async ({ source, sourceHandle, target }: Connection) => {
            if (!source || !sourceHandle || !target) return
            // o backend também barra isso (self-loop), mas checar aqui evita a viagem de ida e
            // volta pro caso mais comum - ciclos mais profundos (A→B→C→A) continuam só sendo
            // pegos no backend, ver tratamento de erro 4xx em flushEdgeOperations.
            if (source === target) {
                toast.warning("Um nó não pode se conectar a si mesmo")
                return
            }
            if (source === START_KEY) await setEntry(target)
            else await connectNodes(source, sourceHandle, target)
        },
        [connectNodes, setEntry]
    )

    const onEdgesDelete = useCallback(
        (edges: Edge[]) => {
            for (const edge of edges)
                if (edge.id === `start-${entryNodeId}` && entryNodeId)
                    void clearEntry(entryNodeId)
                else void deleteEdge(edge.id)
        },
        [clearEntry, deleteEdge, entryNodeId]
    )

    // Mesmo caminho do X do card (deleteNode) - sem isso, apagar pelo Backspace/Delete do teclado
    // só some visualmente (via applyNodeChanges em onNodesChange) e nunca manda a exclusão pro
    // backend, já que remover node não passa por onNodesChange nenhuma chamada de API.
    const onNodesDelete = useCallback(
        (nodes: Node[]) => {
            for (const node of nodes) void deleteNode(node.id)
        },
        [deleteNode]
    )

    function addConfiguredNode(
        type: CanvasNodeType,
        option: DestinationOption
    ) {
        const fallback = contextPositionRef.current ?? {
            x: 100 + (flowNodes.length % 4) * 240,
            y: 120 + Math.floor(flowNodes.length / 4) * 150,
        }
        contextPositionRef.current = null
        const { localId } = createNode(type, option, fallback)
        history.push({
            kind: "create-node",
            nodeId: localId,
            type,
            resourceId: option.id,
            label: option.label ?? null,
            position: fallback,
        })
    }

    return (
        <>
            <div
                ref={canvasRootRef}
                className="relative h-full w-full bg-background"
            >
                {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" />
                        Carregando...
                    </div>
                ) : (
                    <ContextMenu>
                        <ContextMenuTrigger
                            className="block h-full w-full"
                            onContextMenu={(event) => {
                                const instance = flowInstanceRef.current
                                if (!instance) return
                                contextPositionRef.current =
                                    instance.screenToFlowPosition({
                                        x: event.clientX,
                                        y: event.clientY,
                                    })
                            }}
                            onDragOver={(event) => {
                                if (
                                    !event.dataTransfer.types.includes(
                                        NODE_ACTION_DRAG_TYPE
                                    )
                                )
                                    return
                                event.preventDefault()
                                event.dataTransfer.dropEffect = "move"
                            }}
                            onDrop={(event) => {
                                const actionId = event.dataTransfer.getData(
                                    NODE_ACTION_DRAG_TYPE
                                ) as CanvasNodeAction | ""
                                if (!actionId) return
                                event.preventDefault()
                                const instance = flowInstanceRef.current
                                if (!instance) return
                                contextPositionRef.current =
                                    instance.screenToFlowPosition({
                                        x: event.clientX,
                                        y: event.clientY,
                                    })
                                setPendingAction(actionId)
                            }}
                        >
                            <ReactFlow
                                nodes={rfNodes}
                                edges={rfEdges}
                                nodeTypes={NODE_TYPES}
                                edgeTypes={EDGE_TYPES}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onEdgesDelete={onEdgesDelete}
                                onNodesDelete={onNodesDelete}
                                deleteKeyCode={["Backspace", "Delete"]}
                                onMoveStart={showMiniMap}
                                onMoveEnd={scheduleMiniMapHide}
                                onNodeDragStart={showMiniMap}
                                onNodeDragStop={scheduleMiniMapHide}
                                onInit={(instance) => {
                                    flowInstanceRef.current = instance
                                }}
                                fitView
                                fitViewOptions={{ padding: 0.28 }}
                                minZoom={0.35}
                                maxZoom={1.6}
                                proOptions={{ hideAttribution: true }}
                            >
                                <Background gap={28} size={2} />
                                <Controls
                                    showZoom={false}
                                    showFitView={false}
                                    showInteractive={false}
                                >
                                    <ControlButton
                                        onClick={handleAutoLayout}
                                        title="Organizar automaticamente"
                                        aria-label="Organizar automaticamente"
                                    >
                                        <WandSparklesIcon />
                                    </ControlButton>
                                    <ControlButton
                                        onClick={() =>
                                            flowInstanceRef.current?.zoomIn()
                                        }
                                        title="Aumentar zoom"
                                        aria-label="Aumentar zoom"
                                        disabled={isMaxZoomReached}
                                    >
                                        <PlusIcon />
                                    </ControlButton>
                                    <ControlButton
                                        onClick={() =>
                                            flowInstanceRef.current?.zoomOut()
                                        }
                                        title="Diminuir zoom"
                                        aria-label="Diminuir zoom"
                                        disabled={isMinZoomReached}
                                    >
                                        <MinusIcon />
                                    </ControlButton>
                                    <ControlButton
                                        onClick={toggleInteractive}
                                        title={
                                            isInteractive
                                                ? "Bloquear edição"
                                                : "Desbloquear edição"
                                        }
                                        aria-label={
                                            isInteractive
                                                ? "Bloquear edição"
                                                : "Desbloquear edição"
                                        }
                                    >
                                        {isInteractive ? (
                                            <UnlockIcon />
                                        ) : (
                                            <LockIcon />
                                        )}
                                    </ControlButton>
                                </Controls>
                                <MiniMap
                                    pannable
                                    zoomable
                                    position="top-left"
                                    style={{ marginTop: 56 }}
                                    className={
                                        isMiniMapVisible
                                            ? "opacity-100 transition-opacity duration-200"
                                            : "pointer-events-none opacity-0 transition-opacity duration-200"
                                    }
                                />
                            </ReactFlow>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                            <ContextMenuGroup>
                                <ContextMenuLabel>
                                    Adicionar ação
                                </ContextMenuLabel>
                                <ContextMenuSeparator />
                                {NODE_ACTIONS.map((action) => {
                                    const Icon =
                                        ROUTE_DEST_ICONS[
                                            action.resourceTypes[0]
                                        ]
                                    return (
                                        <ContextMenuItem
                                            key={action.id}
                                            onClick={() =>
                                                setPendingAction(action.id)
                                            }
                                        >
                                            <Icon className="size-3.5" />
                                            {action.label}
                                        </ContextMenuItem>
                                    )
                                })}
                            </ContextMenuGroup>
                        </ContextMenuContent>
                    </ContextMenu>
                )}
                <div className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 shadow-sm sm:gap-2 sm:px-2.5">
                    <Label
                        htmlFor="flow-autosave-toggle"
                        title="Salvamento automático"
                        className="flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                    >
                        {autoSave ? (
                            <CloudIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                            <CloudOffIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="hidden sm:inline">
                            Salvamento automático
                        </span>
                    </Label>
                    <Switch
                        id="flow-autosave-toggle"
                        size="sm"
                        checked={autoSave}
                        onCheckedChange={handleToggleAutoSave}
                        disabled={isSavingDraft}
                        className="shrink-0"
                    />
                    {!autoSave && (
                        <>
                            <TooltipProvider delay={200}>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                                aria-label="Descartar alterações"
                                                onClick={() =>
                                                    setShowDiscardConfirm(true)
                                                }
                                                disabled={
                                                    isSavingDraft ||
                                                    isDiscardingDraft ||
                                                    draftDirtyCount === 0
                                                }
                                            >
                                                {isDiscardingDraft ? (
                                                    <Loader2Icon className="size-3 animate-spin" />
                                                ) : (
                                                    <RotateCcwIcon className="size-3" />
                                                )}
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>
                                        {draftDirtyCount > 0
                                            ? `Descartar ${draftDirtyCount} ${draftDirtyCount === 1 ? "alteração não salva" : "alterações não salvas"}`
                                            : "Descartar alterações"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <Button
                                size="sm"
                                variant="secondary"
                                className={cn(
                                    "h-6 shrink-0 gap-1 px-2 text-xs whitespace-nowrap",
                                    draftDirtyCount > 0 &&
                                        "bg-emerald-500 text-emerald-50 hover:bg-emerald-500/20 dark:bg-emerald-900 dark:text-emerald-50 dark:hover:bg-emerald-900/90"
                                )}
                                onClick={() => setShowSaveConfirm(true)}
                                disabled={
                                    isSavingDraft ||
                                    isDiscardingDraft ||
                                    draftDirtyCount === 0
                                }
                            >
                                {isSavingDraft ? (
                                    <Loader2Icon className="size-3 shrink-0 animate-spin" />
                                ) : (
                                    <SaveIcon className="size-3 shrink-0" />
                                )}
                                <span className="hidden sm:inline">
                                    Salvar
                                </span>
                                <span className="sm:hidden">
                                    {draftDirtyCount > 0
                                        ? `Salvar (${draftDirtyCount})`
                                        : "Salvar"}
                                </span>
                            </Button>
                        </>
                    )}
                </div>
                <AlertDialog
                    open={showDiscardConfirm}
                    onOpenChange={(next) => {
                        if (!next && !isDiscardingDraft)
                            setShowDiscardConfirm(false)
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Descartar alterações
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {draftDirtyCount === 1
                                    ? "1 alteração local não salva será perdida"
                                    : `${draftDirtyCount} alterações locais não salvas serão perdidas`}{" "}
                                e o flow volta ao último estado salvo. Essa
                                ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDiscardingDraft}>
                                Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                                disabled={isDiscardingDraft}
                                onClick={async () => {
                                    await discardDraft()
                                    setShowDiscardConfirm(false)
                                }}
                            >
                                {isDiscardingDraft
                                    ? "Descartando..."
                                    : "Descartar"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={showSaveConfirm}
                    onOpenChange={(next) => {
                        if (!next && !isSavingDraft) setShowSaveConfirm(false)
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Salvar alterações
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {draftDirtyCount === 1
                                    ? "1 alteração local será salva"
                                    : `${draftDirtyCount} alterações locais serão salvas`}{" "}
                                no flow.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSavingDraft}>
                                Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                                disabled={isSavingDraft}
                                onClick={async () => {
                                    await saveDraft()
                                    setShowSaveConfirm(false)
                                }}
                            >
                                {isSavingDraft ? "Salvando..." : "Salvar"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                {(refreshing || isSyncingEdges || deletingNodeCount > 0) && (
                    <div className="absolute top-14 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                        <Loader2Icon className="size-3 animate-spin" />
                        {isSyncingEdges
                            ? "Salvando conexões..."
                            : deletingNodeCount > 0
                              ? "Removendo nó..."
                              : "Sincronizando..."}
                    </div>
                )}
                {isNodePanelOpen ? (
                    <div className="absolute top-3 right-3 bottom-3 z-20 flex w-72 flex-col rounded-md border bg-card shadow-sm">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                            <span className="text-xs font-semibold">
                                Adicionar nó
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setIsNodePanelOpen(false)}
                                title="Ocultar painel"
                                aria-label="Ocultar painel"
                            >
                                <PanelRightCloseIcon />
                            </Button>
                        </div>
                        <div className="border-b p-2">
                            <div className="relative">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={nodeActionSearch}
                                    onChange={(event) =>
                                        setNodeActionSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Buscar nó..."
                                    className="pl-7"
                                />
                            </div>
                        </div>
                        <ScrollArea className="min-h-0 flex-1 bg-muted/20">
                            <div className="flex flex-col gap-2 p-2.5">
                                {filteredNodeActions.length === 0 && (
                                    <p className="p-2 text-center text-xs text-muted-foreground">
                                        Nenhum nó encontrado.
                                    </p>
                                )}
                                {filteredNodeActions.map((action) => {
                                    const Icon =
                                        ROUTE_DEST_ICONS[
                                            action.resourceTypes[0]
                                        ]
                                    return (
                                        <button
                                            key={action.id}
                                            type="button"
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData(
                                                    NODE_ACTION_DRAG_TYPE,
                                                    action.id
                                                )
                                                event.dataTransfer.effectAllowed =
                                                    "move"
                                            }}
                                            onClick={() => {
                                                // painel fixo não passa por onContextMenu, então
                                                // limpa uma posição de clique-direito que possa
                                                // ter sobrado - senão o nó nasce lá em vez do
                                                // fallback em grade
                                                contextPositionRef.current =
                                                    null
                                                setPendingAction(action.id)
                                            }}
                                            className="flex items-start gap-2.5 rounded-md border border-border/70 bg-card p-2.5 text-left shadow-sm transition-all duration-150 hover:border-foreground/20 hover:bg-accent/40 hover:shadow-md active:cursor-grabbing"
                                        >
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/30 dark:text-indigo-400">
                                                <Icon className="size-3.5" />
                                            </span>
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-xs font-medium">
                                                    {action.label}
                                                </span>
                                                <span className="text-[0.6875rem] leading-snug text-muted-foreground">
                                                    {action.description}
                                                </span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsNodePanelOpen(true)}
                        className="absolute top-3 right-3 z-20 bg-card"
                        title="Mostrar painel de nós"
                        aria-label="Mostrar painel de nós"
                    >
                        <PanelRightOpenIcon />
                    </Button>
                )}
            </div>
            <NodeActionDialog
                action={pendingAction}
                companyId={flow.companyId}
                open={pendingAction !== null}
                onOpenChange={(open) => !open && setPendingAction(null)}
                onSelect={addConfiguredNode}
                onCreate={(type) => {
                    const position = contextPositionRef.current ?? undefined
                    contextPositionRef.current = null
                    setPendingAction(null)
                    setPendingCreation({ type, position })
                }}
            />
            {pendingCreation && (
                <CreateNodeDialog
                    key={`${pendingCreation.type}:${pendingCreation.source?.nodeId ?? "canvas"}:${pendingCreation.source?.port ?? ""}`}
                    type={pendingCreation.type}
                    open
                    onOpenChange={(open) => !open && setPendingCreation(null)}
                    companyId={flow.companyId}
                    companies={companies.filter(
                        (company) => company.id === flow.companyId
                    )}
                    autoSave={autoSave}
                    onCreateDraftResource={createDraftResource}
                    onCreated={async (option, creationDto) => {
                        const source = pendingCreation.source
                            ? nodeById.get(pendingCreation.source.nodeId)
                            : null
                        const position = source
                            ? {
                                  x: source.position.x + 280,
                                  y: source.position.y + 70,
                              }
                            : (pendingCreation.position ?? {
                                  x: 100 + (flowNodes.length % 4) * 240,
                                  y:
                                      120 +
                                      Math.floor(flowNodes.length / 4) * 150,
                              })
                        const { localId } = createNode(
                            pendingCreation.type,
                            option,
                            position
                        )
                        history.push(
                            pendingCreation.type === "ivr"
                                ? {
                                      kind: "create-node",
                                      nodeId: localId,
                                      type: pendingCreation.type,
                                      resourceId: option.id,
                                      label: option.label ?? null,
                                      position,
                                  }
                                : {
                                      kind: "create-resource-node",
                                      nodeId: localId,
                                      resourceType: pendingCreation.type,
                                      resourceId: option.id,
                                      label: option.label ?? null,
                                      position,
                                      creationDto,
                                  }
                        )
                        if (pendingCreation.source)
                            connectNodes(
                                pendingCreation.source.nodeId,
                                pendingCreation.source.port,
                                localId
                            )
                    }}
                />
            )}
            {editingNode && (
                <EditNodeDialog
                    key={`${editingNode.type}:${editingNode.resourceId}`}
                    type={editingNode.type}
                    id={editingNode.resourceId}
                    open
                    onOpenChange={(open) => !open && setEditingNode(null)}
                    companyId={flow.companyId}
                    companies={companies.filter(
                        (company) => company.id === flow.companyId
                    )}
                    autoSave={autoSave}
                    draftEntity={
                        editingNode.resourceId.startsWith(DRAFT_RES_PREFIX)
                            ? draftResourceCreations.current.get(
                                  editingNode.resourceId
                              )?.form
                            : undefined
                    }
                    onDraftSave={(form) =>
                        applyDraftResourceEdit(
                            editingNode.type,
                            editingNode.resourceId,
                            form
                        )
                    }
                    onDraftUpdate={(form) =>
                        applyDraftResourceEdit(
                            editingNode.type,
                            editingNode.resourceId,
                            form
                        )
                    }
                    onSaved={() => {
                        if (autoSave) void refetchNodes()
                    }}
                    onDeleteResource={(creationDto) =>
                        setResourceToDelete({
                            nodeId: editingNode.nodeId,
                            type: editingNode.type,
                            resourceId: editingNode.resourceId,
                            name: editingNode.name,
                            creationDto,
                        })
                    }
                />
            )}
            <ConfirmDeleteDialog
                open={!!resourceToDelete}
                onOpenChange={(open) => !open && setResourceToDelete(null)}
                title="Excluir recurso e nó"
                itemName={resourceToDelete?.name}
                onConfirm={deleteResource}
            />
        </>
    )
}

export function FlowCanvas(props: Props) {
    return (
        <ReactFlowProvider>
            <FlowCanvasInner {...props} />
        </ReactFlowProvider>
    )
}
