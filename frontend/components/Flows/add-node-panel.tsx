"use client"

import { PlusIcon } from "lucide-react"

import { ROUTE_DEST_ICONS } from "@/components/RouteDestination/route-destination-field"
import {
    NODE_ACTIONS,
    type CanvasNodeAction,
} from "@/components/Flows/node-types"

type Props = {
    onAdd: (action: CanvasNodeAction) => void
}

// O painel não exibe recursos (filas, anúncios, horários). Ele expõe somente ações do fluxo;
// a configuração Asterisk é selecionada no diálogo depois que a ação é escolhida.
export function AddNodePanel({ onAdd }: Props) {
    return (
        <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <PlusIcon className="size-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold">
                            Adicionar ação
                        </h2>
                        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                            Escolha o que a chamada deve fazer. A configuração é
                            selecionada no próximo passo.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">
                    Ações do flow
                </span>
                <div className="space-y-1.5">
                    {NODE_ACTIONS.map((action) => {
                        const Icon = ROUTE_DEST_ICONS[action.resourceTypes[0]]
                        return (
                            <button
                                key={action.id}
                                type="button"
                                onClick={() => onAdd(action.id)}
                                className="flex w-full items-start gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                            >
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <Icon className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="block text-xs font-semibold text-foreground">
                                        {action.label}
                                    </span>
                                    <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted-foreground">
                                        {action.description}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <p className="border-t pt-3 text-[0.6875rem] leading-4 text-muted-foreground">
                Filas, anúncios, horários e demais configurações são criados e
                editados nos menus próprios do sistema.
            </p>
        </aside>
    )
}
