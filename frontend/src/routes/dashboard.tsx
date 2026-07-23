import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppSidebar } from "@/components/Dashboard/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AuthProvider } from "@/hooks/use-auth"
import { hasAuthToken } from "@/lib/auth-cookie"

// Layout route pra tudo em /dashboard/** — equivalente a app/dashboard/layout.tsx +
// proxy.ts (matcher "/dashboard/:path*") do frontend Next, mas o guard roda no client
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!hasAuthToken()) throw redirect({ to: "/login" })
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
