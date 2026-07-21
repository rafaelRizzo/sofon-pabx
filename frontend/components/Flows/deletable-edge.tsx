"use client"

import { useState } from "react"
import {
    BaseEdge,
    EdgeLabelRenderer,
    type EdgeProps,
    useStore,
} from "@xyflow/react"
import { Trash2Icon } from "lucide-react"

export type DeletableEdgeData = { onDelete: () => void }

type Point = { x: number; y: number }
type Obstacle = Point & { width: number; height: number }

const ROUTE_CLEARANCE = 24
const CORNER_RADIUS = 12

function pointKey({ x, y }: Point) {
    return `${x}:${y}`
}

function isInsideObstacle(point: Point, obstacle: Obstacle) {
    return (
        point.x > obstacle.x &&
        point.x < obstacle.x + obstacle.width &&
        point.y > obstacle.y &&
        point.y < obstacle.y + obstacle.height
    )
}

function isClearSegment(a: Point, b: Point, obstacles: Obstacle[]) {
    if (a.x === b.x) {
        const top = Math.min(a.y, b.y)
        const bottom = Math.max(a.y, b.y)
        return !obstacles.some(
            (obstacle) =>
                a.x > obstacle.x &&
                a.x < obstacle.x + obstacle.width &&
                bottom > obstacle.y &&
                top < obstacle.y + obstacle.height
        )
    }

    if (a.y === b.y) {
        const left = Math.min(a.x, b.x)
        const right = Math.max(a.x, b.x)
        return !obstacles.some(
            (obstacle) =>
                a.y > obstacle.y &&
                a.y < obstacle.y + obstacle.height &&
                right > obstacle.x &&
                left < obstacle.x + obstacle.width
        )
    }

    return false
}

function isClearDirectPath(a: Point, b: Point, obstacles: Obstacle[]) {
    const left = Math.min(a.x, b.x)
    const right = Math.max(a.x, b.x)
    const top = Math.min(a.y, b.y)
    const bottom = Math.max(a.y, b.y)

    return !obstacles.some(
        (obstacle) =>
            right > obstacle.x &&
            left < obstacle.x + obstacle.width &&
            bottom > obstacle.y &&
            top < obstacle.y + obstacle.height
    )
}

function simplify(points: Point[]) {
    return points.filter((point, index) => {
        const previous = points[index - 1]
        const next = points[index + 1]
        if (!previous || !next) return true
        return !(
            (previous.x === point.x && point.x === next.x) ||
            (previous.y === point.y && point.y === next.y)
        )
    })
}

function roundedPath(points: Point[]) {
    const route = simplify(points)
    if (route.length < 2) return ""

    let path = `M ${route[0].x} ${route[0].y}`
    for (let index = 1; index < route.length - 1; index++) {
        const previous = route[index - 1]
        const current = route[index]
        const next = route[index + 1]
        const incoming = Math.hypot(
            current.x - previous.x,
            current.y - previous.y
        )
        const outgoing = Math.hypot(next.x - current.x, next.y - current.y)
        const radius = Math.min(CORNER_RADIUS, incoming / 2, outgoing / 2)
        const before = {
            x: current.x + ((previous.x - current.x) / incoming) * radius,
            y: current.y + ((previous.y - current.y) / incoming) * radius,
        }
        const after = {
            x: current.x + ((next.x - current.x) / outgoing) * radius,
            y: current.y + ((next.y - current.y) / outgoing) * radius,
        }
        path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
    }

    const last = route[route.length - 1]
    return `${path} L ${last.x} ${last.y}`
}

function pathMiddle(points: Point[]) {
    const route = simplify(points)
    const total = route
        .slice(1)
        .reduce(
            (length, point, index) =>
                length +
                Math.hypot(point.x - route[index].x, point.y - route[index].y),
            0
        )
    let remaining = total / 2

    for (let index = 1; index < route.length; index++) {
        const start = route[index - 1]
        const end = route[index]
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        if (remaining <= length) {
            const ratio = length === 0 ? 0 : remaining / length
            return {
                x: start.x + (end.x - start.x) * ratio,
                y: start.y + (end.y - start.y) * ratio,
            }
        }
        remaining -= length
    }

    return route[0]
}

// Cria uma malha só com as bordas dos nós e encontra a rota ortogonal mais curta nela.
// As caixas são expandidas em ROUTE_CLEARANCE, assim a linha não encosta no cartão nem
// atravessa seu conteúdo quando há um nó no meio da conexão.
function routeAroundNodes(source: Point, target: Point, obstacles: Obstacle[]) {
    const sourceOutlet = { x: source.x, y: source.y + ROUTE_CLEARANCE }
    const targetInlet = { x: target.x, y: target.y - ROUTE_CLEARANCE }
    const gridObstacles = obstacles.map((obstacle) => ({
        x: obstacle.x - ROUTE_CLEARANCE,
        y: obstacle.y - ROUTE_CLEARANCE,
        width: obstacle.width + ROUTE_CLEARANCE * 2,
        height: obstacle.height + ROUTE_CLEARANCE * 2,
    }))

    // Os cartões têm larguras diferentes, então mesmo quando o usuário os alinha pela grade
    // os handles centrais podem ficar alguns pixels fora. Nessa situação a linha levemente
    // diagonal é mais limpa que criar dois cantos só para compensar essa diferença mínima.
    if (
        target.y > source.y &&
        Math.abs(source.x - target.x) <= ROUTE_CLEARANCE + 8 &&
        isClearDirectPath(source, target, gridObstacles)
    ) {
        return [source, target]
    }

    const xValues = new Set([sourceOutlet.x, targetInlet.x])
    const yValues = new Set([sourceOutlet.y, targetInlet.y])
    for (const obstacle of gridObstacles) {
        xValues.add(obstacle.x)
        xValues.add(obstacle.x + obstacle.width)
        yValues.add(obstacle.y)
        yValues.add(obstacle.y + obstacle.height)
    }

    const points: Point[] = []
    for (const x of xValues) {
        for (const y of yValues) {
            const point = { x, y }
            if (
                !gridObstacles.some((obstacle) =>
                    isInsideObstacle(point, obstacle)
                )
            ) {
                points.push(point)
            }
        }
    }

    const start = points.findIndex(
        (point) => pointKey(point) === pointKey(sourceOutlet)
    )
    const end = points.findIndex(
        (point) => pointKey(point) === pointKey(targetInlet)
    )
    if (start < 0 || end < 0) return [source, sourceOutlet, targetInlet, target]

    const neighbours = new Map<
        number,
        { index: number; direction: "h" | "v"; length: number }[]
    >()
    for (let index = 0; index < points.length; index++)
        neighbours.set(index, [])
    for (let first = 0; first < points.length; first++) {
        for (let second = first + 1; second < points.length; second++) {
            const a = points[first]
            const b = points[second]
            if (
                (a.x !== b.x && a.y !== b.y) ||
                !isClearSegment(a, b, gridObstacles)
            )
                continue
            const direction = a.x === b.x ? "v" : "h"
            const length = Math.hypot(b.x - a.x, b.y - a.y)
            neighbours.get(first)?.push({ index: second, direction, length })
            neighbours.get(second)?.push({ index: first, direction, length })
        }
    }

    type Visit = { index: number; direction: "h" | "v" | null; cost: number }
    const queue: Visit[] = [{ index: start, direction: null, cost: 0 }]
    const costs = new Map<string, number>([[`${start}:none`, 0]])
    const previous = new Map<string, string>()
    let finalKey: string | null = null

    while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost)
        const current = queue.shift()!
        const currentKey = `${current.index}:${current.direction ?? "none"}`
        if (current.cost !== costs.get(currentKey)) continue
        if (current.index === end) {
            finalKey = currentKey
            break
        }

        for (const next of neighbours.get(current.index) ?? []) {
            const cost =
                current.cost +
                next.length +
                (current.direction && current.direction !== next.direction
                    ? 18
                    : 0)
            const nextKey = `${next.index}:${next.direction}`
            if (cost >= (costs.get(nextKey) ?? Infinity)) continue
            costs.set(nextKey, cost)
            previous.set(nextKey, currentKey)
            queue.push({ index: next.index, direction: next.direction, cost })
        }
    }

    if (!finalKey) return [source, sourceOutlet, targetInlet, target]
    const route: Point[] = []
    for (let key: string | undefined = finalKey; key; key = previous.get(key)) {
        route.push(points[Number(key.split(":")[0])])
    }
    route.reverse()
    return [source, ...route, target]
}

// Edge customizada com um botão de lixeira no meio da linha — alternativa mais descobrível a
// selecionar a linha + apertar Delete (onEdgesDelete em flow-canvas.tsx continua funcionando também).
export function DeletableEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style,
    markerEnd,
    data,
}: EdgeProps) {
    const [isHovered, setIsHovered] = useState(false)
    const nodeLookup = useStore((state) => state.nodeLookup)
    const obstacles = Array.from(nodeLookup.values()).flatMap((node) => {
        if (node.id === source || node.id === target) return []
        const position = node.internals.positionAbsolute
        const { width, height } = node.measured
        if (!position || !width || !height) return []
        return [{ x: position.x, y: position.y, width, height }]
    })
    const route = routeAroundNodes(
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
        obstacles
    )
    const edgePath = roundedPath(route)
    const { x: labelX, y: labelY } = pathMiddle(route)
    const onDelete = (data as DeletableEdgeData | undefined)?.onDelete

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={style}
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
                    onClick={(e) => {
                        e.stopPropagation()
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
