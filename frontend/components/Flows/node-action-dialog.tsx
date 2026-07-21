"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    fetchDestinationOptions,
    RouteDestinationField,
    type DestinationOption,
    type RouteDestination,
} from "@/components/RouteDestination/route-destination-field"
import {
    type CanvasNodeAction,
    NODE_ACTIONS,
    NODE_TYPE_CONFIG,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import { apiError } from "@/lib/api"

type Props = {
    action: CanvasNodeAction | null
    companyId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (type: CanvasNodeType, option: DestinationOption) => void
    onCreate: (type: CanvasNodeType) => void
}

export function NodeActionDialog({
    action,
    companyId,
    open,
    onOpenChange,
    onSelect,
    onCreate,
}: Props) {
    const definition = NODE_ACTIONS.find((item) => item.id === action)
    const [destination, setDestination] = useState<RouteDestination>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!definition) {
            setDestination(null)
            return
        }
        setDestination({ type: definition.resourceTypes[0], id: "" })
    }, [definition])

    async function confirm() {
        if (
            !definition ||
            !destination ||
            destination.type === "hangup" ||
            !("id" in destination) ||
            !destination.id
        )
            return
        try {
            setSaving(true)
            const options = await fetchDestinationOptions(
                destination.type,
                companyId
            )
            const option = options.find((item) => item.id === destination.id)
            if (!option) {
                toast.error(
                    "A configuração selecionada não está mais disponível"
                )
                return
            }
            if (option.disabledReason) {
                toast.error(option.disabledReason)
                return
            }
            onSelect(destination.type as CanvasNodeType, option)
            onOpenChange(false)
        } catch (err) {
            toast.error(apiError(err, "Erro ao selecionar configuração"))
        } finally {
            setSaving(false)
        }
    }

    if (!definition) return null

    const selectedType =
        destination && destination.type !== "hangup"
            ? (destination.type as CanvasNodeType)
            : null
    const canCreate = !!selectedType && NODE_TYPE_CONFIG[selectedType].creatable

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{definition.label}</DialogTitle>
                    <DialogDescription>
                        {definition.description} Se ainda não existir uma
                        configuração, crie-a aqui.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <span className="text-xs font-medium">
                        Configuração a usar
                    </span>
                    <RouteDestinationField
                        value={destination}
                        onChange={setDestination}
                        companyId={companyId}
                        allowedTypes={definition.resourceTypes}
                    />
                </div>

                <DialogFooter>
                    {canCreate && (
                        <Button
                            variant="outline"
                            onClick={() => onCreate(selectedType)}
                        >
                            Criar configuração
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={confirm}
                        disabled={
                            saving ||
                            !destination ||
                            destination.type === "hangup" ||
                            !("id" in destination) ||
                            !destination.id
                        }
                    >
                        {saving ? "Adicionando..." : "Adicionar ao flow"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
