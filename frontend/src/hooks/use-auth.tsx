import { createContext, useCallback, useContext } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

const AUTH_ME_QUERY_KEY = ["auth-me"]

async function fetchMeRequest(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get("/auth/me")
    return data.user
  } catch {
    return null
  }
}

// Espelha o catálogo do backend (backend/src/utils/auth/permissions.ts); só relevante para
// role "user" (admin tem acesso irrestrito, ver hasPermission abaixo).
// `category` agrupa a lista na UI de edição de usuário (user-form-dialog.tsx) - não existe no
// backend, é só apresentação.
export const PERMISSION_RESOURCES = [
  { key: "companies", label: "Empresas", category: "Administração" },
  { key: "users", label: "Usuários", category: "Administração" },
  { key: "extensions", label: "Ramais", category: "Telefonia" },
  { key: "trunks", label: "Troncos", category: "Telefonia" },
  { key: "inbound-routes", label: "Rotas de entrada", category: "Roteamento" },
  { key: "outbound-routes", label: "Rotas de saída", category: "Roteamento" },
  { key: "queues", label: "Filas", category: "Filas e atendimento" },
  { key: "callcenter", label: "Callcenter", category: "Filas e atendimento" },
  { key: "flows", label: "Flows", category: "Automação" },
  { key: "ivr", label: "URA", category: "Automação" },
  { key: "announcements", label: "Anúncios", category: "Automação" },
  { key: "audios", label: "Áudios", category: "Automação" },
  { key: "time-groups", label: "Grupos de horário", category: "Automação" },
  { key: "time-conditions", label: "Condições de horário", category: "Automação" },
  { key: "holiday-groups", label: "Feriados", category: "Automação" },
  { key: "request-templates", label: "Templates de requisição", category: "Automação" },
  { key: "variables", label: "Variáveis", category: "Automação" },
  { key: "variable-conditions", label: "Condições de variável", category: "Automação" },
  { key: "variable-catalog", label: "Catálogo de Variáveis", category: "Automação" },
  { key: "integrations", label: "Credenciais de integração", category: "Automação" },
  { key: "ixc", label: "Nós IXCsoft", category: "Automação" },
  { key: "formatter", label: "Nós Formatter", category: "Automação" },
] as const

export type PermissionResourceKey = (typeof PERMISSION_RESOURCES)[number]["key"]
export type PermissionAction = "view" | "manage"

export type AuthUser = {
  id: string
  name: string
  username: string
  role: "admin" | "user"
  permissions: string[]
  extensionId: string | null
  avatarUpdatedAt: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  hasPermission: (
    resource: PermissionResourceKey | "cdr" | "call-quality" | "audit-logs" | "backup" | "dids",
    action?: PermissionAction
  ) => boolean
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user = null, isLoading: loading } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchMeRequest,
  })

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
  }, [queryClient])

  // otimista enquanto carrega, evita flash de menu vazio; a garantia real é o backend
  // (requirePermission), isso aqui é só cosmético
  const hasPermission = useCallback<AuthContextValue["hasPermission"]>(
    (resource, action = "view") => {
      if (loading || !user) return true
      if (user.role === "admin") return true
      return user.permissions.includes(`${resource}:${action}`)
    },
    [user, loading]
  )

  return (
    <AuthContext.Provider value={{ user, loading, hasPermission, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
