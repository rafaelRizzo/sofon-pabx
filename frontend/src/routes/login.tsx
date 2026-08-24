import { createFileRoute, redirect } from "@tanstack/react-router"
import { MoonIcon, SunIcon } from "lucide-react"

import { LoginForm } from "@/components/Login/login-form"
import { LoginShowcase } from "@/components/Login/login-showcase"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { hasAuthToken } from "@/lib/auth-cookie"

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (hasAuthToken()) throw redirect({ to: "/dashboard" })
  },
  component: LoginPage,
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

function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <ThemeToggle />
      <LoginShowcase className="hidden lg:flex" />
      <div className="flex items-center justify-center bg-background p-4 sm:p-6">
        <LoginForm />
      </div>
    </div>
  )
}
