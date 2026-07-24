import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FlowCanvas } from "@/components/Flows/flow-canvas"
import { useCompanies } from "@/hooks/use-companies"
import { useFlow, useFlowNodes } from "@/hooks/use-flows"

function FlowEditorPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { companies } = useCompanies()
    // Flow (metadados) e nós/edges são buscados em paralelo (ambos só dependem do id da rota, não
    // um do outro) — evita a tela mostrar "carregou o flow" e só depois "carregou os nós" em
    // sequência, um loading visível de cada vez.
    const { flow, loading: flowLoading } = useFlow(id)
    const flowNodesState = useFlowNodes(id)
    const loading = flowLoading || flowNodesState.loading

    return (
        <div className="relative h-[calc(100dvh-6rem)] w-full overflow-hidden rounded-md border">
            {loading || !flow ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Carregando...
                </div>
            ) : (
                <FlowCanvas
                    flow={flow}
                    companies={companies}
                    flowNodesState={flowNodesState}
                />
            )}

            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-md border bg-card/95 py-1.5 pr-2.5 pl-1.5 shadow-sm backdrop-blur-sm">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => navigate({ to: "/dashboard/flows" })}
                >
                    <ArrowLeftIcon className="size-4" />
                    <span className="sr-only">Voltar</span>
                </Button>
                <h1 className="text-sm font-semibold">
                    {flow?.name ?? "Carregando..."}
                </h1>
            </div>
        </div>
    )
}

export const Route = createFileRoute("/dashboard/flows/$id")({
    component: FlowEditorPage,
})
