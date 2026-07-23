import { createFileRoute } from "@tanstack/react-router"

function CdrPage() {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">CDR</h1>
            <p className="text-sm text-muted-foreground">Em construção</p>
        </div>
    )
}

export const Route = createFileRoute("/dashboard/cdr")({
  component: CdrPage,
})
