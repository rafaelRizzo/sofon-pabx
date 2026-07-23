import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FlowCanvas } from "@/components/Flows/flow-canvas"
import { useCompanies } from "@/hooks/use-companies"
import { useFlow } from "@/hooks/use-flows"

function FlowEditorPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { companies } = useCompanies()
    const { flow, loading } = useFlow(id)

    return (
        <div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate({ to: "/dashboard/flows" })}
                >
                    <ArrowLeftIcon />
                    <span className="sr-only">Voltar</span>
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-lg font-semibold">
                        {flow?.name ?? "Carregando..."}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Cada card é uma instância independente; você pode
                        reutilizar a mesma fila ou aplicação em vários pontos do
                        fluxo.
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1 rounded-md border">
                {loading || !flow ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Carregando...
                    </div>
                ) : (
                    <FlowCanvas flow={flow} companies={companies} />
                )}
            </div>
        </div>
    )
}

export const Route = createFileRoute("/dashboard/flows/$id")({
    component: FlowEditorPage,
})
