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

export function DashboardBreadcrumb() {
    const { pathname } = useLocation()
    const current = findCurrentNav(pathname)

    if (!current) return null

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>{current.group.label}</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage>{current.item.title}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    )
}
