import { createFileRoute, redirect } from "@tanstack/react-router"

import { LoginForm } from "@/components/Login/login-form"
import { LoginMarquee } from "@/components/Login/login-marquee"
import { hasAuthToken } from "@/lib/auth-cookie"

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (hasAuthToken()) throw redirect({ to: "/dashboard" })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-x-hidden bg-background p-4 sm:p-6">
      <LoginMarquee className="fixed" />
      <LoginForm className="relative" />
    </div>
  )
}
