import { createFileRoute, Outlet } from "@tanstack/react-router"

// Layout puro: /dashboard/flows precisa existir como rota pai de /dashboard/flows/$id (o
// TanStack Router aninha automaticamente pelo prefixo do path), então só repassa pro Outlet —
// o conteúdo real da lista mora em flows.index.tsx
export const Route = createFileRoute("/dashboard/flows")({
    component: () => <Outlet />,
})
