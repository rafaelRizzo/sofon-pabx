import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Toaster } from "@/components/ui/sonner"
import { ErrorPage } from "@/components/error-page"
import { NotFoundPage } from "@/components/not-found-page"
import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider } from "@/components/theme-provider"

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ({ error, reset }) => (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <ErrorPage error={error} reset={reset} />
        </ThemeProvider>
    ),
    notFoundComponent: () => (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <NotFoundPage />
        </ThemeProvider>
    ),
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
