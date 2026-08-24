import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import Cookies from "universal-cookie"

import { api } from "@/lib/api"

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cookies = new Cookies()

  const logout = async () => {
    try {
      await api.post("/auth/logout")
    } catch {
      // mesmo se a revogação falhar, encerra a sessão local
    } finally {
      cookies.remove("token", { path: "/" })
      // limpa o cache do React Query: sem isso, dados da sessão anterior (empresas, usuários,
      // permissões, senhas de trunk) ficam em memória e vazam pro próximo login na mesma aba
      queryClient.clear()
      toast.success("Sessão encerrada")
      navigate({ to: "/login" })
    }
  }

  return { logout }
}
