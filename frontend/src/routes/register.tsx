import { createFileRoute, redirect } from "@tanstack/react-router"
import { MoonIcon, SunIcon } from "lucide-react"

import { LoginShowcase } from "@/components/Login/login-showcase"
import { RegisterForm } from "@/components/Login/register-form"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { hasAuthToken } from "@/lib/auth-cookie"

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    if (hasAuthToken()) throw redirect({ to: "/dashboard" })

    // rota só existe pra criar o primeiro usuário do sistema - com usuário(s) já cadastrado(s)
    // o backend rejeita POST /auth/register (403), então nem faz sentido liberar a tela.
    // Falha ao consultar o status (rede/backend fora do ar) assume o caminho seguro (login) em
    // vez de arriscar expor a tela de criação de admin por causa de uma falha transitória.
    let hasUsers = true
    try {
      const { data } = await api.get("/auth/status")
      hasUsers = data.hasUsers
    } catch {
      hasUsers = true
    }

    if (hasUsers) throw redirect({ to: "/login" })
  },
  component: RegisterPage,
})

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="fixed top-4 right-4 z-10"
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

function RegisterPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <ThemeToggle />
      <LoginShowcase className="hidden lg:flex" />
      <div className="flex items-center justify-center bg-background p-4 sm:p-6">
        <RegisterForm />
      </div>
    </div>
  )
}
