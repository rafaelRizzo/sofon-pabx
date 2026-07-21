"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CircleDotIcon,
    GitBranchIcon,
    PlayIcon,
    PlusIcon,
    PencilIcon,
    XIcon,
    type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    ROUTE_DEST_ICONS,
    ROUTE_DEST_LABELS,
    type RouteDestinationType,
} from "@/components/RouteDestination/route-destination-field"
import {
    SLOT_LABELS,
    SLOT_COLORS,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import { BranchConnectPopover } from "@/components/Flows/branch-connect-popover"

export type SlotTarget = { type: string; id: string; name: string }

export type FlowNodeData = {
    nodeType: RouteDestinationType
    // id do recurso compartilhado; o id do React Flow é a instância FlowNode.
    resourceId: string | null
    actionLabel: string
    name: string
    slots: string[]
    companyId: string
    slotTargets?: Record<string, SlotTarget>
    onRemove?: (key: string) => void
    onConnectSlot?: (
        slot: string,
        type: CanvasNodeType,
        id: string,
        label: string
    ) => void
    onDisconnectSlot?: (slot: string) => void
    onCreateSlot?: (slot: string, type: CanvasNodeType) => void
    onEdit?: () => void
}

type BranchSlot = "false" | "true" | "error" | "success"

const BRANCH_PAIRS: BranchSlot[][] = [
    ["false", "true"],
    ["error", "success"],
]

function getBranchSlots(slots: string[]) {
    return BRANCH_PAIRS.find((pair) =>
        pair.every((slot) => slots.includes(slot))
    )
}

function sourceLeft(index: number, total: number) {
    return `${((index + 1) / (total + 1)) * 100}%`
}

type SlotChipProps = {
    slot: string
    label: string
    colorText: string
    target?: SlotTarget
    companyId: string
    align?: "start" | "end" | "center"
    directionIcon?: LucideIcon
    onConnectSlot?: FlowNodeData["onConnectSlot"]
    onDisconnectSlot?: FlowNodeData["onDisconnectSlot"]
    onCreateSlot?: FlowNodeData["onCreateSlot"]
}

// Chip clicável de saída — vazio abre o picker de destino (BranchConnectPopover) sem precisar
// arrastar uma linha; conectado mostra o destino real (ícone+nome) e um "x" pra desconectar. O
// handle de drag do React Flow (Handle, na base do card) continua funcionando em paralelo — isso
// é aditivo, não substitui a conexão por arraste.
function SlotChip({
    slot,
    label,
    colorText,
    target,
    companyId,
    align = "center",
    directionIcon: DirectionIcon,
    onConnectSlot,
    onDisconnectSlot,
    onCreateSlot,
}: SlotChipProps) {
    const justify =
        align === "start"
            ? "justify-start"
            : align === "end"
                ? "justify-end"
                : "justify-center"

    if (target) {
        const Icon = ROUTE_DEST_ICONS[target.type as RouteDestinationType]
        return (
            <div
                className={`group/slot relative flex min-h-8 items-center gap-0.5 rounded-md border border-border/70 bg-card pr-0.5 pl-2 shadow-xs ${colorText}`}
            >
                <BranchConnectPopover
                    companyId={companyId}
                    onSelect={(type, opt) =>
                        onConnectSlot?.(slot, type, opt.id, opt.label)
                    }
                    onCreate={(type) => onCreateSlot?.(slot, type)}
                    trigger={
                        <button
                            type="button"
                            className="nodrag flex min-w-0 flex-1 items-center justify-center gap-1.5 py-1 text-[0.6875rem] font-semibold"
                        >
                            {Icon && <Icon className="size-3.5 shrink-0" />}
                            <span className="truncate">{target.name}</span>
                        </button>
                    }
                />
                <button
                    type="button"
                    className="nodrag shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/slot:opacity-100 hover:text-destructive"
                    aria-label="Remover conexão"
                    title="Remover conexão"
                    onClick={(event) => {
                        event.stopPropagation()
                        onDisconnectSlot?.(slot)
                    }}
                >
                    <XIcon className="size-3" />
                </button>
            </div>
        )
    }

    return (
        <BranchConnectPopover
            companyId={companyId}
            onSelect={(type, opt) =>
                onConnectSlot?.(slot, type, opt.id, opt.label)
            }
            onCreate={(type) => onCreateSlot?.(slot, type)}
            trigger={
                <button
                    type="button"
                    className={`nodrag flex min-h-8 w-full items-center gap-1 rounded-md border border-dashed border-border/70 bg-transparent px-2 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary ${justify}`}
                >
                    {DirectionIcon ? (
                        <DirectionIcon className="size-3.5" />
                    ) : (
                        <PlusIcon className="size-3.5" />
                    )}
                    <span>{label}</span>
                </button>
            }
        />
    )
}

// Nó genérico do canvas — 1 handle de entrada (topo) + N handles de saída (base), um por slot
// (ex: "true"/"false" pra Time Condition, "success"/"error" pra Request Template). staticSlots +
// slots vistos no grafo (ex: dígitos configurados de IVR, quando presente só como alvo) —
// resolvido antes de montar os nós, ver flow-canvas.tsx.
export function FlowNode({
    id,
    data,
    selected,
}: NodeProps & { data: FlowNodeData }) {
    const Icon = ROUTE_DEST_ICONS[data.nodeType]
    const slots = data.slots
    const branchSlots = getBranchSlots(slots)
    const remainingSlots = branchSlots
        ? slots.filter((slot) => !branchSlots.includes(slot as BranchSlot))
        : slots
    const outputSlots = branchSlots
        ? [...branchSlots, ...remainingSlots]
        : remainingSlots

    return (
        <div
            className={`group relative min-w-56 overflow-visible rounded-xl border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color] duration-150 hover:shadow-md ${selected ? "border-primary ring-2 ring-primary/25" : "border-border"}`}
            onDoubleClick={() => data.onEdit?.()}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="size-3.5! border-2! border-card! shadow-sm dark:border-neutral-700!"
            />

            <div className="flex items-start gap-2.5 px-3 pt-3 pb-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/50 text-primary dark:text-indigo-400">
                    <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                    <span
                        className="truncate text-sm leading-5 font-semibold"
                        title={data.actionLabel}
                    >
                        {data.actionLabel}
                    </span>
                    <span className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                        {data.name}
                    </span>
                </div>
                {data.onEdit && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="nodrag nowheel ml-auto size-7 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Editar configuração"
                        title="Editar configuração"
                        onClick={(event) => {
                            event.stopPropagation()
                            data.onEdit?.()
                        }}
                    >
                        <PencilIcon className="size-3.5" />
                        <span className="sr-only">Editar configuração</span>
                    </Button>
                )}
                {data.onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="nodrag nowheel size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover nó do canvas"
                        title="Remover nó do canvas"
                        onClick={(event) => {
                            event.stopPropagation()
                            data.onRemove?.(id)
                        }}
                    >
                        <XIcon className="size-3.5" />
                        <span className="sr-only">Remover nó do canvas</span>
                    </Button>
                )}
            </div>

            {slots.length === 0 ? (
                <div className="border-t border-border/70 bg-muted/35 px-3 py-2.5">
                    <span className="flex items-center justify-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">
                        <CircleDotIcon className="size-3.5" />
                        Fim desta rota
                    </span>
                </div>
            ) : (
                <div className="border-t border-border/70 bg-muted/35 px-3 py-2.5">
                    {branchSlots && (
                        <div className="mb-2 flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
                            <GitBranchIcon className="size-3.5" />
                            Bifurcação
                        </div>
                    )}

                    {branchSlots && (
                        <div className="grid grid-cols-2 gap-2">
                            {branchSlots.map((slot) => {
                                const isLeft =
                                    slot === "false" || slot === "error"
                                return (
                                    <SlotChip
                                        key={slot}
                                        slot={slot}
                                        label={SLOT_LABELS[slot] ?? slot}
                                        colorText="text-muted-foreground"
                                        target={data.slotTargets?.[slot]}
                                        companyId={data.companyId}
                                        align={isLeft ? "start" : "end"}
                                        directionIcon={
                                            isLeft
                                                ? ArrowLeftIcon
                                                : ArrowRightIcon
                                        }
                                        onConnectSlot={data.onConnectSlot}
                                        onDisconnectSlot={data.onDisconnectSlot}
                                        onCreateSlot={data.onCreateSlot}
                                    />
                                )
                            })}
                        </div>
                    )}

                    {remainingSlots.length > 0 && (
                        <div
                            className={`${branchSlots ? "mt-2 border-t border-border/60 pt-2" : ""} grid gap-2`}
                            style={{
                                gridTemplateColumns: `repeat(${Math.min(remainingSlots.length, 3)}, minmax(0, 1fr))`,
                            }}
                        >
                            {remainingSlots.map((slot) => {
                                const color = SLOT_COLORS[slot]
                                const label =
                                    SLOT_LABELS[slot] || "Próximo passo"
                                return (
                                    <SlotChip
                                        key={slot}
                                        slot={slot}
                                        label={label}
                                        colorText={
                                            color?.text ??
                                            "text-muted-foreground"
                                        }
                                        target={data.slotTargets?.[slot]}
                                        companyId={data.companyId}
                                        onConnectSlot={data.onConnectSlot}
                                        onDisconnectSlot={data.onDisconnectSlot}
                                        onCreateSlot={data.onCreateSlot}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {outputSlots.map((slot, index) => {
                const color = SLOT_COLORS[slot]
                return (
                    <Handle
                        key={slot}
                        type="source"
                        position={Position.Bottom}
                        id={slot}
                        style={{ left: sourceLeft(index, outputSlots.length) }}
                        className={`size-3.5! border-2! border-card! shadow-sm dark:border-neutral-700! ${color?.handle ?? ""}`}
                    />
                )
            })}
        </div>
    )
}

// Nó sintético fixo — representa o próprio entryDestination do Flow (por onde a chamada entra).
// Não tem entidade por trás, só 1 handle de saída — conectar dele pra outro nó chama
// updateFlow(flowId, { entryDestination }) em vez do dispatcher genérico por tipo.
export function StartNode() {
    return (
        <div className="min-w-56 overflow-visible rounded-xl border border-emerald-500/40 bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-2.5 px-3 py-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <PlayIcon className="size-4" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                        Início do flow
                    </span>
                    <span className="text-[0.6875rem] font-medium text-muted-foreground">
                        Entrada da chamada
                    </span>
                </div>
            </div>
            <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center text-[0.6875rem] font-medium text-emerald-700 dark:text-emerald-400">
                Arraste para conectar
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                id="entry"
                className="size-3.5! border-2! border-card! bg-emerald-500! shadow-sm dark:border-neutral-700!"
            />
        </div>
    )
}
