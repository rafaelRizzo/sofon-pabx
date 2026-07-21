"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    applyNodeChanges,
    type Connection,
    type Edge,
    type EdgeTypes,
    type Node,
    type NodeChange,
    type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "@/components/Flows/flow-canvas.css"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { type DestinationOption } from "@/components/RouteDestination/route-destination-field"
import { AddNodePanel } from "@/components/Flows/add-node-panel"
import { CreateNodeDialog } from "@/components/Flows/create-node-dialog"
import { EditNodeDialog } from "@/components/Flows/edit-node-dialog"
import { NodeActionDialog } from "@/components/Flows/node-action-dialog"
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
    type CanvasNodeAction,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import { useFlowNodes, type Flow } from "@/hooks/use-flows"
import { type Company } from "@/hooks/use-companies"

const START_KEY = "start"

const NODE_TYPES: NodeTypes = {
    flowNode: FlowNode as any,
    startNode: StartNode,
}
const EDGE_TYPES: EdgeTypes = { deletable: DeletableEdge as any }

function edgeStyleForSlot(slot: string) {
    const stroke =
        {
            true: "var(--flow-branch-positive)",
            success: "var(--flow-branch-positive)",
            false: "var(--flow-branch-negative)",
            error: "var(--flow-branch-negative)",
        }[slot] ?? "var(--color-primary)"
    return { stroke, strokeWidth: 2 }
}

type Props = { flow: Flow; companies: Company[] }

function FlowCanvasInner({ flow, companies }: Props) {
    const {
        nodes: flowNodes,
        edges: flowEdges,
        entryNodeId,
        loading,
        refreshing,
        refetchNodes,
    } = useFlowNodes(flow.id)
    const [rfNodes, setRfNodes] = useState<Node[]>([])
    const [rfEdges, setRfEdges] = useState<Edge[]>([])
    const [pendingAction, setPendingAction] = useState<CanvasNodeAction | null>(
        null
    )
    const [pendingCreation, setPendingCreation] = useState<{
        type: CanvasNodeType
        source?: { nodeId: string; port: string }
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
    } | null>(null)
    const pendingPositions = useRef(new Map<string, { x: number; y: number }>())
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const nodeById = useMemo(
        () => new Map(flowNodes.map((node) => [node.id, node])),
        [flowNodes]
    )

    const deleteEdge = useCallback(
        async (edgeId: string) => {
            try {
                await api.delete(`/flows/${flow.id}/node-edges/${edgeId}`)
                await refetchNodes()
            } catch (err) {
                toast.error(apiError(err, "Erro ao remover conexão"))
            }
        },
        [flow.id, refetchNodes]
    )

    const deleteNode = useCallback(
        async (nodeId: string) => {
            try {
                await api.delete(`/flows/${flow.id}/nodes/${nodeId}`)
                await refetchNodes()
                toast.success("Nó removido")
            } catch (err) {
                toast.error(apiError(err, "Erro ao remover nó"))
            }
        },
        [flow.id, refetchNodes]
    )

    const deleteResource = useCallback(async () => {
        if (!resourceToDelete) return false
        try {
            await api.post(
                `/flows/${flow.id}/nodes/${resourceToDelete.nodeId}/resource-deletion-check`
            )
            await api.delete(
                `/flows/${flow.id}/nodes/${resourceToDelete.nodeId}`
            )
            await api.delete(
                `/${NODE_TYPE_CONFIG[resourceToDelete.type].apiPath}/${resourceToDelete.resourceId}`
            )
            setEditingNode(null)
            await refetchNodes()
            toast.success("Recurso e nó excluídos")
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao excluir recurso"))
            return false
        }
    }, [flow.id, refetchNodes, resourceToDelete])

    const connectNodes = useCallback(
        async (
            sourceNodeId: string,
            sourcePort: string,
            targetNodeId: string
        ) => {
            try {
                await api.post(`/flows/${flow.id}/node-edges`, {
                    sourceNodeId,
                    sourcePort,
                    targetNodeId,
                })
                await refetchNodes()
            } catch (err) {
                toast.error(apiError(err, "Erro ao conectar nós"))
            }
        },
        [flow.id, refetchNodes]
    )

    const setEntry = useCallback(
        async (nodeId: string) => {
            try {
                await api.put(`/flows/${flow.id}/nodes/${nodeId}`, {
                    isEntry: true,
                })
                await refetchNodes()
            } catch (err) {
                toast.error(apiError(err, "Erro ao definir início do flow"))
            }
        },
        [flow.id, refetchNodes]
    )

    const clearEntry = useCallback(
        async (nodeId: string) => {
            try {
                await api.put(`/flows/${flow.id}/nodes/${nodeId}`, {
                    isEntry: false,
                })
                await refetchNodes()
            } catch (err) {
                toast.error(apiError(err, "Erro ao remover início do flow"))
            }
        },
        [flow.id, refetchNodes]
    )

    const createNode = useCallback(
        async (
            type: CanvasNodeType,
            option: DestinationOption,
            position: { x: number; y: number }
        ) => {
            try {
                const { data } = await api.post(`/flows/${flow.id}/nodes`, {
                    type,
                    resourceId: option.id,
                    label: option.label,
                    position,
                })
                await refetchNodes()
                return data.nodeId as string
            } catch (err) {
                toast.error(apiError(err, "Erro ao adicionar nó"))
                return null
            }
        },
        [flow.id, refetchNodes]
    )

    useEffect(() => {
        const nodes: Node[] = [
            {
                id: START_KEY,
                type: "startNode",
                position: { x: 80, y: 40 },
                data: {},
                deletable: false,
            },
        ]
        for (const node of flowNodes) {
            const config = NODE_TYPE_CONFIG[node.type as CanvasNodeType]
            const outgoing = flowEdges.filter(
                (edge) => edge.sourceNodeId === node.id
            )
            const slots = [
                ...new Set([
                    ...(config?.staticSlots ?? []),
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
                    name: node.label ?? node.resourceId ?? "Nó sem recurso",
                    slots,
                    companyId: flow.companyId,
                    slotTargets,
                    onRemove: deleteNode,
                    onConnectSlot: async (slot, type, resourceId, label) => {
                        const source = nodeById.get(node.id)
                        if (!source) return
                        const targetId = await createNode(
                            type,
                            { id: resourceId, label },
                            {
                                x: node.position.x + 280,
                                y: node.position.y + 70,
                            }
                        )
                        if (targetId)
                            await connectNodes(source.id, slot, targetId)
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
        nodeById,
        createNode,
        connectNodes,
        deleteEdge,
        deleteNode,
        clearEntry,
    ])

    const persistPositions = useCallback(async () => {
        const entries = [...pendingPositions.current.entries()]
        pendingPositions.current.clear()
        try {
            await Promise.all(
                entries.map(([id, position]) =>
                    api.put(`/flows/${flow.id}/nodes/${id}`, { position })
                )
            )
        } catch (err) {
            toast.error(apiError(err, "Erro ao salvar posição dos nós"))
        }
    }, [flow.id])

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setRfNodes((current) => applyNodeChanges(changes, current))
            for (const change of changes) {
                if (
                    change.type === "position" &&
                    change.position &&
                    change.id !== START_KEY
                )
                    pendingPositions.current.set(change.id, change.position)
            }
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(persistPositions, 450)
        },
        [persistPositions]
    )

    const onConnect = useCallback(
        async ({ source, sourceHandle, target }: Connection) => {
            if (!source || !sourceHandle || !target) return
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

    function addConfiguredNode(
        type: CanvasNodeType,
        option: DestinationOption
    ) {
        const fallback = {
            x: 100 + (flowNodes.length % 4) * 240,
            y: 120 + Math.floor(flowNodes.length / 4) * 150,
        }
        void createNode(type, option, fallback)
    }

    return (
        <>
            <div className="flex h-full w-full">
                <aside className="w-80 shrink-0 overflow-y-auto border-r bg-card/40 p-4">
                    <AddNodePanel onAdd={setPendingAction} />
                </aside>
                <div className="relative flex-1 bg-background">
                    <ReactFlow
                        nodes={rfNodes}
                        edges={rfEdges}
                        nodeTypes={NODE_TYPES}
                        edgeTypes={EDGE_TYPES}
                        onNodesChange={onNodesChange}
                        onConnect={onConnect}
                        onEdgesDelete={onEdgesDelete}
                        fitView
                        fitViewOptions={{ padding: 0.28 }}
                        minZoom={0.35}
                        maxZoom={1.6}
                        snapToGrid
                        snapGrid={[16, 16]}
                        connectionLineStyle={{
                            stroke: "var(--color-primary)",
                            strokeWidth: 2,
                        }}
                    >
                        <Background gap={24} size={1} />
                        <Controls />
                        <MiniMap pannable zoomable />
                    </ReactFlow>
                    {(loading || refreshing) && (
                        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                            <Loader2Icon className="size-3 animate-spin" />
                            {loading ? "Carregando..." : "Sincronizando..."}
                        </div>
                    )}
                </div>
            </div>
            <NodeActionDialog
                action={pendingAction}
                companyId={flow.companyId}
                open={pendingAction !== null}
                onOpenChange={(open) => !open && setPendingAction(null)}
                onSelect={addConfiguredNode}
                onCreate={(type) => {
                    setPendingAction(null)
                    setPendingCreation({ type })
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
                    onCreated={async (option) => {
                        const source = pendingCreation.source
                            ? nodeById.get(pendingCreation.source.nodeId)
                            : null
                        const position = source
                            ? {
                                  x: source.position.x + 280,
                                  y: source.position.y + 70,
                              }
                            : {
                                  x: 100 + (flowNodes.length % 4) * 240,
                                  y:
                                      120 +
                                      Math.floor(flowNodes.length / 4) * 150,
                              }
                        const nodeId = await createNode(
                            pendingCreation.type,
                            option,
                            position
                        )
                        if (nodeId && pendingCreation.source)
                            await connectNodes(
                                pendingCreation.source.nodeId,
                                pendingCreation.source.port,
                                nodeId
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
                    onSaved={() => void refetchNodes()}
                    onDeleteResource={() =>
                        setResourceToDelete({
                            nodeId: editingNode.nodeId,
                            type: editingNode.type,
                            resourceId: editingNode.resourceId,
                            name: editingNode.name,
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
