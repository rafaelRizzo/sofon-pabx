import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError, setAccessTokenCookie } from "@/lib/api"

// Espelha registerSchema do backend (backend/src/modules/auth/schemas/auth.schema.ts)
export const registerFormSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  username: z.email("Informe um e-mail válido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
})
export type RegisterForm = z.infer<typeof registerFormSchema>

export function useRegister() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", username: "", password: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    const id = toast.loading("Criando conta...")
    try {
      const { data: res } = await api.post("/auth/register", data)
      queryClient.clear()
      setAccessTokenCookie(res.token)
      toast.success("Conta criada com sucesso", { id })
      navigate({ to: "/dashboard" })
    } catch (err) {
      toast.error(apiError(err, "Erro ao criar conta"), { id })
    }
  })

  return { ...form, onSubmit }
}
