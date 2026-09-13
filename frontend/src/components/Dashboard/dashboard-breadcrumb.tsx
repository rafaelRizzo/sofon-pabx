import { useLocation } from "@tanstack/react-router"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NAV } from "@/components/Dashboard/app-sidebar"

function findCurrentNav(pathname: string) {
    for (const group of NAV) {
        const item = group.items.find((item) =>
            item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href)
        )
        if (item) return { group, item }
    }
    return null
}

// Rotas que existem mas não entram no NAV (não são recurso com permissão, ex: conta pessoal) -
// sem isso o header ficava só com o SidebarTrigger solto e um espaço vazio enorme ao lado
const STATIC_TITLES: Record<string, string> = {
    "/dashboard/profile": "Meu perfil",
}

function findStaticTitle(pathname: string) {
    return Object.entries(STATIC_TITLES).find(([href]) => pathname.startsWith(href))?.[1]
}

export function DashboardBreadcrumb() {
    const { pathname } = useLocation()
    const current = findCurrentNav(pathname)
    const staticTitle = !current ? findStaticTitle(pathname) : undefined

    if (!current && !staticTitle) return null

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
                {current ? (
                    <>
                        <BreadcrumbItem>{current.group.label}</BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{current.item.title}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                ) : (
                    <BreadcrumbItem>
                        <BreadcrumbPage>{staticTitle}</BreadcrumbPage>
                    </BreadcrumbItem>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
