"use client"

import { useState } from "react"
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    getStraightPath,
    type EdgeProps,
} from "@xyflow/react"
import { Trash2Icon } from "lucide-react"

export type DeletableEdgeData = { onDelete: () => void }

// Alinhamento manual por arrasto nunca é pixel-perfeito - poucos px de diferença em X já bastam
// pro smoothstep desenhar um micro-degrau em vez de uma linha reta. Dentro dessa tolerância,
// tratamos como alinhado.
const ALIGN_TOLERANCE_PX = 8

// Rota nativa: custo constante por aresta durante drag. A implementação anterior recalculava
// uma malha completa contra todos os nós em toda atualização de posição.
export function DeletableEdge({
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    style,
    markerEnd,
    data,
    selected,
}: EdgeProps) {
    const [isHovered, setIsHovered] = useState(false)
    const isNearlyAligned = Math.abs(sourceX - targetX) <= ALIGN_TOLERANCE_PX
    const [edgePath, labelX, labelY] = isNearlyAligned
        ? getStraightPath({ sourceX, sourceY, targetX, targetY })
        : getSmoothStepPath({
              sourceX,
              sourceY,
              sourcePosition,
              targetX,
              targetY,
              targetPosition,
              borderRadius: 12,
          })
    const onDelete = (data as DeletableEdgeData | undefined)?.onDelete

    // Sem isso, clicar numa aresta pra selecioná-la (pré-requisito pro Backspace/Delete apagar,
    // ver deleteKeyCode em flow-canvas.tsx) não dava nenhum retorno visual - parecia que a seleção
    // simplesmente não acontecia.
    const selectedStyle = selected
        ? { stroke: "var(--color-indigo-500)", strokeWidth: 3 }
        : undefined

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{ ...style, ...selectedStyle }}
                markerEnd={markerEnd}
            />
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                className="cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            />
            <EdgeLabelRenderer>
                <button
                    type="button"
                    className="nodrag nopan absolute flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-[opacity,transform,border-color,color] duration-150 ease-out hover:border-destructive hover:text-destructive"
                    style={{
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${isHovered ? 1 : 0})`,
                        pointerEvents: isHovered ? "all" : "none",
                        opacity: isHovered ? 1 : 0,
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={(event) => {
                        event.stopPropagation()
                        onDelete?.()
                    }}
                >
                    <Trash2Icon className="size-3" />
                    <span className="sr-only">Remover conexão</span>
                </button>
            </EdgeLabelRenderer>
        </>
    )
}
