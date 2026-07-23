import { createFileRoute, redirect } from "@tanstack/react-router"

import { hasAuthToken } from "@/lib/auth-cookie"

// Espelha app/page.tsx do Next: "/" nunca renderiza nada, só decide pra onde mandar
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: hasAuthToken() ? "/dashboard" : "/login" })
  },
})
