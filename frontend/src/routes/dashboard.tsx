import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router"

import { AppSidebar } from "@/components/Dashboard/app-sidebar"
import { DashboardBreadcrumb } from "@/components/Dashboard/dashboard-breadcrumb"
import { WebphoneWidget } from "@/components/Webphone/webphone-widget"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AuthProvider } from "@/hooks/use-auth"
import { hasAuthToken } from "@/lib/auth-cookie"
import { cn } from "@/lib/utils"

// Layout route pra tudo em /dashboard/** - equivalente a app/dashboard/layout.tsx +
// proxy.ts (matcher "/dashboard/:path*") do frontend Next, mas o guard roda no client
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!hasAuthToken()) throw redirect({ to: "/login" })
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { pathname } = useLocation()
  // Editor de flow é canvas full-bleed, sem padding do shell (a própria página cuida do espaçamento)
  const isFlowEditor = pathname.startsWith("/dashboard/flows/")

  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-2 h-full" />
            <DashboardBreadcrumb />
          </header>
          <main
            className={cn(
              "min-w-0 flex-1 overflow-x-hidden",
              isFlowEditor ? "p-0" : "p-6"
            )}
          >
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <WebphoneWidget />
    </AuthProvider>
  )
}
