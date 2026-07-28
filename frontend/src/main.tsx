import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createRouter, RouterProvider } from "@tanstack/react-router"

import { NotFoundPage } from "@/components/not-found-page"
import { ThemeProvider } from "@/components/theme-provider"

import "./index.css"
import { routeTree } from "./routeTree.gen"

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NotFoundPage />
    </ThemeProvider>
  ),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
