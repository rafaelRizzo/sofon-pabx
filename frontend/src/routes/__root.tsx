import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Toaster } from "@/components/ui/sonner"
import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider } from "@/components/theme-provider"

export const Route = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <QueryProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <Outlet />
                <Toaster richColors={true} position="top-right" />
                {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
            </ThemeProvider>
        </QueryProvider>
    )
}
