"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Building2Icon,
    FileAudioIcon,
    FileClockIcon,
    HashIcon,
    LayoutDashboardIcon,
    LogOutIcon,
    MoonIcon,
    NetworkIcon,
    PhoneIcon,
    PhoneIncomingIcon,
    PhoneOutgoingIcon,
    SunIcon,
    UsersIcon,
    WorkflowIcon,
    type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuth, type PermissionResourceKey } from "@/hooks/use-auth"
import { useLogout } from "@/hooks/use-logout"

type NavItem = {
    title: string
    href: string
    icon: LucideIcon
    // omitido = sempre visível (ex: Dashboard); presente = precisa de "<permission>:view"
    // (admin/reseller sempre veem tudo, só role "user" é filtrado; ver useAuth().hasPermission)
    permission?: PermissionResourceKey | "cdr"
}

type NavGroup = {
    label: string
    items: NavItem[]
}

// Recursos reutilizáveis são criados e configurados no contexto do Flow, sem poluir a navegação.
const NAV: NavGroup[] = [
    {
        label: "Geral",
        items: [
            {
                title: "Dashboard",
                href: "/dashboard",
                icon: LayoutDashboardIcon,
            },
            {
                title: "CDR",
                href: "/dashboard/cdr",
                icon: FileClockIcon,
                permission: "cdr",
            },
        ],
    },
    {
        label: "Administração",
        items: [
            {
                title: "Empresas",
                href: "/dashboard/companies",
                icon: Building2Icon,
                permission: "companies",
            },
            {
                title: "Usuários",
                href: "/dashboard/users",
                icon: UsersIcon,
                permission: "users",
            },
        ],
    },
    {
        label: "Atendimento",
        items: [
            {
                title: "Ramais",
                href: "/dashboard/extensions",
                icon: PhoneIcon,
                permission: "extensions",
            },
        ],
    },
    {
        label: "Rotas",
        items: [
            {
                title: "DIDs",
                href: "/dashboard/dids",
                icon: HashIcon,
                permission: "dids",
            },
            {
                title: "Rotas de entrada",
                href: "/dashboard/inbound-routes",
                icon: PhoneIncomingIcon,
                permission: "inbound-routes",
            },
            {
                title: "Rotas de saída",
                href: "/dashboard/outbound-routes",
                icon: PhoneOutgoingIcon,
                permission: "outbound-routes",
            },
            {
                title: "Troncos",
                href: "/dashboard/trunks",
                icon: NetworkIcon,
                permission: "trunks",
            },
        ],
    },
    {
        label: "Recursos",
        items: [
            {
                title: "Áudios",
                href: "/dashboard/audios",
                icon: FileAudioIcon,
                permission: "audios",
            },
            {
                title: "Flows",
                href: "/dashboard/flows",
                icon: WorkflowIcon,
                permission: "flows",
            },
        ],
    },
]

export function AppSidebar() {
    const pathname = usePathname()
    const { isMobile, setOpenMobile } = useSidebar()
    const { resolvedTheme, setTheme } = useTheme()
    const { logout } = useLogout()
    const { hasPermission } = useAuth()

    const isActive = (href: string) =>
        href === "/dashboard" ? pathname === href : pathname.startsWith(href)

    const visibleNav = NAV.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => !item.permission || hasPermission(item.permission)
        ),
    })).filter((group) => group.items.length > 0)

    return (
        <TooltipProvider delay={100}>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                        <PhoneIcon className="size-5 shrink-0" />
                        <span className="font-semibold group-data-[collapsible=icon]:hidden">
                            Sofon PABX
                        </span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    {visibleNav.map((group) => (
                        <SidebarGroup
                            key={group.label}
                            className="group-data-[collapsible=icon]:py-0"
                        >
                            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {group.items.map((item) => (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                isActive={isActive(item.href)}
                                                tooltip={item.title}
                                                render={
                                                    <Link
                                                        href={item.href}
                                                        onClick={() =>
                                                            isMobile &&
                                                            setOpenMobile(false)
                                                        }
                                                    >
                                                        <item.icon />
                                                        <span>
                                                            {item.title}
                                                        </span>
                                                    </Link>
                                                }
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ))}
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Alternar tema"
                                onClick={() =>
                                    setTheme(
                                        resolvedTheme === "dark"
                                            ? "light"
                                            : "dark"
                                    )
                                }
                            >
                                <span className="relative flex size-4 shrink-0 items-center justify-center">
                                    <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                                    <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                                </span>
                                <span>Alternar tema</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Sair" onClick={logout}>
                                <LogOutIcon />
                                <span>Sair</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
        </TooltipProvider>
    )
}
