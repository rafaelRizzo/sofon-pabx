import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import { api } from "@/lib/api"

// Espelha o catálogo do backend (backend/src/utils/auth/permissions.ts); só relevante para
// role "user" (admin/reseller têm acesso irrestrito, ver hasPermission abaixo)
export const PERMISSION_RESOURCES = [
  { key: "companies", label: "Empresas" },
  { key: "users", label: "Usuários" },
  { key: "extensions", label: "Ramais" },
  { key: "queues", label: "Filas" },
  { key: "ivr", label: "URA" },
  { key: "announcements", label: "Anúncios" },
  { key: "callcenter", label: "Callcenter" },
  { key: "dids", label: "DIDs" },
  { key: "inbound-routes", label: "Rotas de entrada" },
  { key: "outbound-routes", label: "Rotas de saída" },
  { key: "trunks", label: "Troncos" },
  { key: "audios", label: "Áudios" },
  { key: "time-groups", label: "Grupos de horário" },
  { key: "time-conditions", label: "Condições de horário" },
  { key: "holiday-groups", label: "Feriados" },
  { key: "request-templates", label: "Templates de requisição" },
  { key: "integrations", label: "Credenciais de integração" },
  { key: "ixc", label: "Nós IXCsoft" },
  { key: "variables", label: "Variáveis" },
  { key: "variable-conditions", label: "Condições de variável" },
  { key: "flows", label: "Flows" },
] as const

export type PermissionResourceKey = (typeof PERMISSION_RESOURCES)[number]["key"]
export type PermissionAction = "view" | "manage"

export type AuthUser = {
  id: string
  name: string
  username: string
  role: "admin" | "reseller" | "user"
  permissions: string[]
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  hasPermission: (
    resource: PermissionResourceKey | "cdr",
    action?: PermissionAction
  ) => boolean
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me")
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  // otimista enquanto carrega, evita flash de menu vazio; a garantia real é o backend
  // (requirePermission), isso aqui é só cosmético
  const hasPermission = useCallback<AuthContextValue["hasPermission"]>(
    (resource, action = "view") => {
      if (loading || !user) return true
      if (user.role !== "user") return true
      return user.permissions.includes(`${resource}:${action}`)
    },
    [user, loading]
  )

  return (
    <AuthContext.Provider
      value={{ user, loading, hasPermission, refetch: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
