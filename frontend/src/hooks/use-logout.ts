import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { api, clearAccessTokenCookie } from "@/lib/api"
import { useWebphone } from "@/hooks/use-webphone"

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hangup } = useWebphone()

  const logout = async () => {
    // encerra qualquer ligação em curso ANTES de derrubar a sessão - desmontar o
    // WebphoneProvider (efeito colateral do logout) já limpa a sessão SIP, mas isso depende da
    // ordem de re-render; chamar direto garante que o BYE sai na hora, sem esperar o unmount
    await hangup().catch(() => {})
    try {
      await api.post("/auth/logout")
    } catch {
      // mesmo se a revogação falhar, encerra a sessão local
    } finally {
      clearAccessTokenCookie()
      // limpa o cache do React Query: sem isso, dados da sessão anterior (empresas, usuários,
      // permissões, senhas de trunk) ficam em memória e vazam pro próximo login na mesma aba
      queryClient.clear()
      toast.success("Sessão encerrada")
      navigate({ to: "/login" })
    }
  }

  return { logout }
}
