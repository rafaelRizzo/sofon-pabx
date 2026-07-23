import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Bem-vindo ao painel do Sofon PABX
    </div>
  )
}
