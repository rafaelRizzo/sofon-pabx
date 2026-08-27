import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { api, apiError, setAccessTokenCookie } from "@/lib/api"

type LoginForm = {
  username: string
  password: string
}

export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const form = useForm<LoginForm>({
    defaultValues: { username: "", password: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    const id = toast.loading("Entrando...")
    try {
      const { data: res } = await api.post("/auth/login", data)
      // limpa qualquer cache remanescente de uma sessão anterior na mesma aba antes de logar
      queryClient.clear()
      setAccessTokenCookie(res.token)
      toast.success("Login realizado", { id })
      navigate({ to: "/dashboard" })
    } catch (err) {
      toast.error(apiError(err, "Erro ao realizar login"), { id })
    }
  })

  return { ...form, onSubmit }
}
