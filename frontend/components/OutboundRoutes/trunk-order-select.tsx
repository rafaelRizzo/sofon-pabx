"use client"

import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { type Trunk } from "@/hooks/use-trunks"

type Props = {
    trunks: Trunk[]
    value: string[]
    onChange: (trunkIds: string[]) => void
    className?: string
}

// Ordem da lista = ordem de failover enviada em trunkIds (posição 0 é o tronco primário).
// Selecionados ficam no topo, em ordem, e podem ser arrastados para reordenar a prioridade.
export function TrunkOrderSelect({
    trunks,
    value,
    onChange,
    className,
}: Props) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    function toggle(trunkId: string, checked: boolean) {
        onChange(
            checked ? [...value, trunkId] : value.filter((id) => id !== trunkId)
        )
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = value.indexOf(String(active.id))
        const newIndex = value.indexOf(String(over.id))
        onChange(arrayMove(value, oldIndex, newIndex))
    }

    if (trunks.length === 0) {
        return (
            <p className={cn("text-sm text-muted-foreground", className)}>
                Nenhum tronco cadastrado para esta empresa
            </p>
        )
    }

    const selectedTrunks = value
        .map((id) => trunks.find((t) => t.id === id))
        .filter((t): t is Trunk => !!t)
    const unselectedTrunks = trunks.filter((t) => !value.includes(t.id))

    return (
        <div className={cn("space-y-1", className)}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={value}
                    strategy={verticalListSortingStrategy}
                >
                    {selectedTrunks.map((trunk, index) => (
                        <SortableTrunkRow
                            key={trunk.id}
                            trunk={trunk}
                            index={index}
                            onRemove={() => toggle(trunk.id, false)}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            {unselectedTrunks.map((trunk) => (
                <div
                    key={trunk.id}
                    className="flex items-center gap-2 py-1 pl-6"
                >
                    <label className="flex flex-1 items-center gap-2 text-sm font-normal">
                        <Checkbox
                            checked={false}
                            onCheckedChange={(checked) =>
                                toggle(trunk.id, checked === true)
                            }
                        />
                        {trunk.name}
                        <span className="text-xs text-muted-foreground">
                            {trunk.registrationMode === "custom"
                                ? `custom → ${trunk.context}`
                                : (trunk.host ?? "")}
                        </span>
                    </label>
                </div>
            ))}
        </div>
    )
}

type SortableTrunkRowProps = {
    trunk: Trunk
    index: number
    onRemove: () => void
}

function SortableTrunkRow({ trunk, index, onRemove }: SortableTrunkRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: trunk.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-2 rounded-md py-1",
                isDragging && "z-10 bg-accent opacity-90 shadow-sm"
            )}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label="Arrastar para reordenar"
            >
                <GripVerticalIcon className="size-4 shrink-0" />
            </button>
            <label className="flex flex-1 items-center gap-2 text-sm font-normal">
                <Checkbox checked onCheckedChange={onRemove} />
                <span className="font-medium">{trunk.name}</span>
                <span className="text-xs text-muted-foreground">
                    {trunk.registrationMode === "custom"
                        ? `custom → ${trunk.context}`
                        : (trunk.host ?? "")}
                </span>
            </label>
            <Badge variant="secondary">{index + 1}º</Badge>
        </div>
    )
}
