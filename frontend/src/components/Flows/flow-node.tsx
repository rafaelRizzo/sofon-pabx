"use client"

import type { ReactNode } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CircleDotIcon,
    GitBranchIcon,
    PlayIcon,
    PlusIcon,
    XIcon,
    type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    ROUTE_DEST_ICONS,
    type RouteDestinationType,
} from "@/components/RouteDestination/route-destination-field"
import {
    SLOT_LABELS,
    SLOT_COLORS,
    SLOT_ICONS,
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

// Ordem fixa de exibição das saídas de exceção da URA — independe da ordem em que os slots chegam
// (staticSlots + edges já existentes), sempre lida da mesma forma da esquerda pra direita.
const IVR_EXCEPTION_ORDER = ["invalid", "timeout", "long"]

function getBranchSlots(slots: string[]) {
    return BRANCH_PAIRS.find((pair) =>
        pair.every((slot) => slots.includes(slot))
    )
}

function digitOf(slot: string) {
    return slot.slice("digit:".length)
}

function slotLabel(slot: string) {
    if (slot.startsWith("digit:")) return `Tecla ${digitOf(slot)}`
    return SLOT_LABELS[slot] || "Próximo passo"
}

// Handle de saída aninhado dentro do próprio chip (não mais distribuído por porcentagem na base
// inteira do card) — cada bolinha de conexão fica exatamente junto ao botão a que pertence. Em
// linhas empilhadas verticalmente (teclado da URA), a bolinha fica na borda direita de CADA linha
// (não embaixo) — assim todas as bolinhas alinham numa única coluna vertical do lado de fora,
// evitando o emaranhado de linhas cruzando quando várias teclas apontam pro mesmo destino.
function SlotHandle({
    slot,
    handleColor,
    side = "bottom",
}: {
    slot: string
    handleColor?: string
    side?: "bottom" | "right"
}) {
    const sideClasses =
        side === "right"
            ? "inset-y-0! my-auto! transform-none! -right-[20.5px]! left-auto!"
            : "top-auto! -bottom-[10.5px]! left-1/2! -translate-x-1/2!"
    return (
        <Handle
            type="source"
            position={side === "right" ? Position.Right : Position.Bottom}
            id={slot}
            className={`absolute! ${sideClasses} size-3.5! border-2! border-card! shadow-sm dark:border-neutral-700! ${handleColor ?? ""}`}
        />
    )
}

type SlotChipProps = {
    slot: string
    label: string
    colorText: string
    handleColor?: string
    target?: SlotTarget
    companyId: string
    align?: "start" | "end" | "center"
    icon?: LucideIcon
    // selo pequeno persistente à esquerda (dígito da tecla) — mostrado nos dois estados (vazio/conectado)
    badge?: ReactNode
    // "row": linha cheia com o handle na borda direita (teclado da URA, uma tecla por linha)
    layout?: "default" | "row"
    onConnectSlot?: FlowNodeData["onConnectSlot"]
    onDisconnectSlot?: FlowNodeData["onDisconnectSlot"]
    onCreateSlot?: FlowNodeData["onCreateSlot"]
}

// Chip clicável de saída — vazio abre o picker de destino (BranchConnectPopover) sem precisar
// arrastar uma linha; conectado mostra o destino real (ícone+nome) e um "x" pra desconectar. O
// handle de drag do React Flow continua funcionando em paralelo, aninhado no próprio chip (ver
// SlotHandle) — isso é aditivo, não substitui a conexão por arraste.
function SlotChip({
    slot,
    label,
    colorText,
    handleColor,
    target,
    companyId,
    align = "center",
    icon: EmptyIcon = PlusIcon,
    badge,
    layout = "default",
    onConnectSlot,
    onDisconnectSlot,
    onCreateSlot,
}: SlotChipProps) {
    const isRow = layout === "row"
    const justify =
        align === "start"
            ? "justify-start"
            : align === "end"
                ? "justify-end"
                : "justify-center"

    // Layout "row" (teclado da URA): 1 grupo só, como um input-group — selo do dígito com contraste
    // forte (bg sólida), colado sem gap na borda do próprio controle, dividido só por um traço
    // interno. Layout "default" (bifurcação/genérico): chip isolado como antes.
    if (isRow) {
        return (
            <div
                className={`relative flex min-h-8 min-w-0 flex-1 items-stretch rounded-md border shadow-xs ${target ? `border-border/70 bg-card ${colorText}` : "border-dashed border-border/70 bg-transparent"}`}
            >
                {badge && (
                    <span className="flex w-7 shrink-0 items-center justify-center rounded-l-md border-r border-border/70 bg-secondary text-xs font-bold text-secondary-foreground">
                        {badge}
                    </span>
                )}
                {target ? (
                    <div className="group/slot relative flex min-w-0 flex-1 items-stretch gap-1 p-1">
                        {/* espaçador invisível do mesmo tamanho do botão de remover — mesmo motivo
                        do layout "default": mantém o texto centralizado na caixa toda em vez de só
                        no espaço que sobra ao lado do botão (reservado mesmo com opacity-0). */}
                        <span aria-hidden className="w-6 shrink-0" />
                        <BranchConnectPopover
                            companyId={companyId}
                            defaultType={target.type as CanvasNodeType}
                            currentOption={{ id: target.id, label: target.name }}
                            onSelect={(type, opt) =>
                                onConnectSlot?.(slot, type, opt.id, opt.label)
                            }
                            onCreate={(type) => onCreateSlot?.(slot, type)}
                            trigger={
                                <button
                                    type="button"
                                    className="nodrag flex min-w-0 flex-1 items-center justify-center gap-1 text-[0.6875rem] font-semibold"
                                >
                                    {(() => {
                                        const Icon =
                                            ROUTE_DEST_ICONS[
                                            target.type as RouteDestinationType
                                            ]
                                        return (
                                            Icon && (
                                                <Icon className="size-3.5 shrink-0" />
                                            )
                                        )
                                    })()}
                                    <span className="truncate">
                                        {target.name}
                                    </span>
                                </button>
                            }
                        />
                        <TooltipProvider delay={200}>
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon-sm"
                                            className="nodrag shrink-0 opacity-0 transition-opacity group-hover/slot:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                            aria-label="Remover conexão"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                onDisconnectSlot?.(slot)
                                            }}
                                        >
                                            <XIcon className="size-3" />
                                        </Button>
                                    }
                                />
                                <TooltipContent>Remover conexão</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                ) : (
                    <BranchConnectPopover
                        companyId={companyId}
                        onSelect={(type, opt) =>
                            onConnectSlot?.(slot, type, opt.id, opt.label)
                        }
                        onCreate={(type) => onCreateSlot?.(slot, type)}
                        trigger={
                            <button
                                type="button"
                                className="nodrag flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-r-md px-2 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                            >
                                <EmptyIcon className="size-3.5 shrink-0" />
                                <span className="truncate">{label}</span>
                            </button>
                        }
                    />
                )}
                <SlotHandle slot={slot} handleColor={handleColor} side="right" />
            </div>
        )
    }

    const content = target ? (
        <div
            className={`group/slot relative flex min-h-8 min-w-0 flex-1 items-stretch gap-1 rounded-md border border-border/70 bg-card p-1 shadow-xs ${colorText}`}
        >
            {/* espaçador invisível do mesmo tamanho do botão de remover — sem ele o texto só
            centraliza no espaço que sobra ao lado do botão (reservado mesmo com opacity-0),
            ficando puxado pra esquerda do centro real da caixa. Com o espaçador nos dois lados
            o espaço reservado é sempre simétrico, então nada precisa se mover/truncar no hover. */}
            <span aria-hidden className="w-6 shrink-0" />
            <BranchConnectPopover
                companyId={companyId}
                defaultType={target.type as CanvasNodeType}
                currentOption={{ id: target.id, label: target.name }}
                onSelect={(type, opt) =>
                    onConnectSlot?.(slot, type, opt.id, opt.label)
                }
                onCreate={(type) => onCreateSlot?.(slot, type)}
                trigger={
                    <button
                        type="button"
                        className={`nodrag flex min-w-0 flex-1 items-center gap-1.5 text-[0.6875rem] font-semibold ${justify}`}
                    >
                        {(() => {
                            const Icon =
                                ROUTE_DEST_ICONS[
                                target.type as RouteDestinationType
                                ]
                            return Icon && <Icon className="size-3.5 shrink-0" />
                        })()}
                        <span className="wrap-break-word">{target.name}</span>
                    </button>
                }
            />
            <TooltipProvider delay={200}>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                className="nodrag shrink-0 opacity-0 transition-opacity group-hover/slot:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Remover conexão"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onDisconnectSlot?.(slot)
                                }}
                            >
                                <XIcon className="size-3" />
                            </Button>
                        }
                    />
                    <TooltipContent>Remover conexão</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    ) : (
        <BranchConnectPopover
            companyId={companyId}
            onSelect={(type, opt) => onConnectSlot?.(slot, type, opt.id, opt.label)}
            onCreate={(type) => onCreateSlot?.(slot, type)}
            trigger={
                <button
                    type="button"
                    className={`nodrag flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-dashed border-border/70 bg-transparent px-2 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted/50 hover:text-foreground ${justify}`}
                >
                    <EmptyIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                </button>
            }
        />
    )

    return (
        <div className="relative flex min-w-0">
            {content}
            <SlotHandle slot={slot} handleColor={handleColor} />
        </div>
    )
}

type ExceptionRowProps = Pick<
    FlowNodeData,
    "companyId" | "slotTargets" | "onConnectSlot" | "onDisconnectSlot" | "onCreateSlot"
> & { slots: string[] }

// Saídas de exceção da URA (inválido/timeout/coleta) — visualmente secundárias em relação ao
// teclado: rótulo pequeno acima de cada uma (já que a conexão troca o texto do botão pelo nome do
// destino) em vez do selo numérico usado nas teclas.
function ExceptionRow({
    slots,
    companyId,
    slotTargets,
    onConnectSlot,
    onDisconnectSlot,
    onCreateSlot,
}: ExceptionRowProps) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {slots.map((slot) => {
                const Icon = SLOT_ICONS[slot]
                return (
                    <div key={slot} className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-1 text-[0.5625rem] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                            {Icon && <Icon className="size-2.5 shrink-0" />}
                            <span className="min-w-0 truncate">{slotLabel(slot)}</span>
                        </span>
                        <SlotChip
                            slot={slot}
                            label={slotLabel(slot)}
                            colorText="text-muted-foreground"
                            target={slotTargets?.[slot]}
                            companyId={companyId}
                            onConnectSlot={onConnectSlot}
                            onDisconnectSlot={onDisconnectSlot}
                            onCreateSlot={onCreateSlot}
                        />
                    </div>
                )
            })}
        </div>
    )
}

type KeypadProps = Pick<
    FlowNodeData,
    "companyId" | "slotTargets" | "onConnectSlot" | "onDisconnectSlot" | "onCreateSlot"
> & { slots: string[] }

// Lista de teclas da URA — 1 coluna, uma linha por tecla, dígito num selo fixo à esquerda (sempre
// visível, conectado ou não) e a bolinha de conexão na borda direita de cada linha. Lida em ordem
// crescente (não na ordem de chegada das edges). Coluna única em vez de grid evita o emaranhado de
// linhas cruzando quando várias teclas apontam pro mesmo destino (bolinhas ficam todas alinhadas
// numa única coluna vertical do lado de fora do card).
function Keypad({
    slots,
    companyId,
    slotTargets,
    onConnectSlot,
    onDisconnectSlot,
    onCreateSlot,
}: KeypadProps) {
    const digits = [...slots].sort(
        (a, b) => Number(digitOf(a)) - Number(digitOf(b))
    )
    return (
        <div className="flex flex-col gap-1.5">
            {digits.map((slot) => (
                <SlotChip
                    key={slot}
                    slot={slot}
                    label="Conectar"
                    colorText="text-muted-foreground"
                    target={slotTargets?.[slot]}
                    companyId={companyId}
                    layout="row"
                    badge={digitOf(slot)}
                    onConnectSlot={onConnectSlot}
                    onDisconnectSlot={onDisconnectSlot}
                    onCreateSlot={onCreateSlot}
                />
            ))}
        </div>
    )
}

// Nó genérico do canvas — 1 handle de entrada (topo) + N handles de saída, um por slot (ex:
// "true"/"false" pra Time Condition, "success"/"error" pra Request Template, teclado pra URA) —
// resolvido antes de montar os nós, ver flow-canvas.tsx.
export function FlowNode({
    id,
    data,
    selected,
}: NodeProps & { data: FlowNodeData }) {
    const Icon = ROUTE_DEST_ICONS[data.nodeType]
    const slots = data.slots
    const isIvr = data.nodeType === "ivr"

    const branchSlots = !isIvr ? getBranchSlots(slots) : undefined
    const remainingSlots = branchSlots
        ? slots.filter((slot) => !branchSlots.includes(slot as BranchSlot))
        : slots

    const digitSlots = isIvr
        ? slots.filter((slot) => slot.startsWith("digit:"))
        : []
    const exceptionSlots = isIvr
        ? IVR_EXCEPTION_ORDER.filter((slot) => slots.includes(slot))
        : []

    return (
        <div
            className={`group relative min-w-56 rounded-xl border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color] duration-150 outline-none hover:shadow-md focus-visible:ring-5 focus-visible:ring-ring/30 dark:focus-visible:ring-ring/45 ${selected ? "border-indigo-950/10 ring-4 ring-indigo-500/15 dark:border-indigo-500/60 dark:ring-indigo-500/25" : "border-border/60 dark:border-neutral-500/25"}`}
            onDoubleClick={() => data.onEdit?.()}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="size-3.5! border-2! border-card! shadow-sm dark:border-neutral-700!"
            />

            <div className="flex items-start gap-2.5 rounded-t-xl px-3 pt-3 pb-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-indigo-400">
                    <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                    <span
                        className="truncate text-sm leading-5 font-semibold"
                        title={data.actionLabel}
                    >
                        {data.actionLabel}
                    </span>
                    <span className="mt-0.5 truncate text-[0.6875rem] font-medium text-muted-foreground">
                        {data.name}
                    </span>
                </div>
                {data.onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="nodrag nowheel ml-auto size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                <div className="rounded-b-xl border-t border-border/70 bg-muted/35 px-3 py-2.5">
                    <span className="flex items-center justify-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">
                        <CircleDotIcon className="size-3.5" />
                        Fim desta rota
                    </span>
                </div>
            ) : isIvr ? (
                <div className="flex flex-col gap-2 rounded-b-xl border-t border-border/70 bg-muted/35 px-3 py-2.5">
                    {digitSlots.length > 0 && (
                        <Keypad
                            slots={digitSlots}
                            companyId={data.companyId}
                            slotTargets={data.slotTargets}
                            onConnectSlot={data.onConnectSlot}
                            onDisconnectSlot={data.onDisconnectSlot}
                            onCreateSlot={data.onCreateSlot}
                        />
                    )}
                    {exceptionSlots.length > 0 && (
                        <div
                            className={
                                digitSlots.length > 0
                                    ? "border-t border-border/60 pt-3"
                                    : ""
                            }
                        >
                            <ExceptionRow
                                slots={exceptionSlots}
                                companyId={data.companyId}
                                slotTargets={data.slotTargets}
                                onConnectSlot={data.onConnectSlot}
                                onDisconnectSlot={data.onDisconnectSlot}
                                onCreateSlot={data.onCreateSlot}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-b-xl border-t border-border/70 bg-muted/35 px-3 py-2.5">
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
                                const color = SLOT_COLORS[slot]
                                return (
                                    <SlotChip
                                        key={slot}
                                        slot={slot}
                                        label={SLOT_LABELS[slot] ?? slot}
                                        colorText="text-muted-foreground"
                                        handleColor={color?.handle}
                                        target={data.slotTargets?.[slot]}
                                        companyId={data.companyId}
                                        icon={
                                            isLeft
                                                ? ArrowLeftIcon
                                                : ArrowRightIcon
                                        }
                                        onConnectSlot={data.onConnectSlot}
                                        onDisconnectSlot={
                                            data.onDisconnectSlot
                                        }
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
                                const label = slotLabel(slot)
                                return (
                                    <SlotChip
                                        key={slot}
                                        slot={slot}
                                        label={label}
                                        colorText={
                                            color?.text ??
                                            "text-muted-foreground"
                                        }
                                        handleColor={color?.handle}
                                        target={data.slotTargets?.[slot]}
                                        companyId={data.companyId}
                                        onConnectSlot={data.onConnectSlot}
                                        onDisconnectSlot={
                                            data.onDisconnectSlot
                                        }
                                        onCreateSlot={data.onCreateSlot}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Nó sintético fixo — representa o próprio entryDestination do Flow (por onde a chamada entra).
// Não tem entidade por trás, só 1 handle de saída — conectar dele pra outro nó chama
// updateFlow(flowId, { entryDestination }) em vez do dispatcher genérico por tipo.
export function StartNode() {
    return (
        <div className="relative min-w-56 overflow-visible rounded-xl border border-emerald-500/40 bg-card text-card-foreground shadow-sm">
            {/* wrapper separado do handle — overflow-hidden aqui clipa o fundo das seções nos
            cantos arredondados do card sem cortar o círculo do handle (que fica metade fora) */}
            <div className="overflow-hidden rounded-xl">
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
