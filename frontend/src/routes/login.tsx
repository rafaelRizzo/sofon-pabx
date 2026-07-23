import { createFileRoute, redirect } from "@tanstack/react-router"

import { LoginForm } from "@/components/Login/login-form"
import { hasAuthToken } from "@/lib/auth-cookie"

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (hasAuthToken()) throw redirect({ to: "/dashboard" })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <LoginForm />
    </div>
  )
}
