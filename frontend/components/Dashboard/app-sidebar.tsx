"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Building2Icon,
    CalendarClockIcon,
    CalendarDaysIcon,
    ClockIcon,
    FileAudioIcon,
    FileClockIcon,
    HashIcon,
    HeadsetIcon,
    LayoutDashboardIcon,
    ListOrderedIcon,
    LogOutIcon,
    MegaphoneIcon,
    MoonIcon,
    NetworkIcon,
    PhoneIcon,
    PhoneIncomingIcon,
    PhoneOutgoingIcon,
    SunIcon,
    UsersIcon,
    WebhookIcon,
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
    SidebarSeparator,
    useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLogout } from "@/hooks/use-logout"

type NavItem = {
    title: string
    href: string
    icon: LucideIcon
}

type NavGroup = {
    label: string
    items: NavItem[]
}

// Grupos organizados pelo fluxo da chamada:
// tronco/DID → rota de entrada → atendimento (URA/fila/ramal) → rota de saída
const NAV: NavGroup[] = [
    {
        label: "Geral",
        items: [
            {
                title: "Dashboard",
                href: "/dashboard",
                icon: LayoutDashboardIcon,
            },
            { title: "CDR", href: "/dashboard/cdr", icon: FileClockIcon },
        ],
    },
    {
        label: "Administração",
        items: [
            {
                title: "Empresas",
                href: "/dashboard/companies",
                icon: Building2Icon,
            },
            { title: "Usuários", href: "/dashboard/users", icon: UsersIcon },
        ],
    },
    {
        label: "Atendimento",
        items: [
            { title: "Ramais", href: "/dashboard/extensions", icon: PhoneIcon },
            {
                title: "Filas",
                href: "/dashboard/queues",
                icon: ListOrderedIcon,
            },
            { title: "URA", href: "/dashboard/ivr", icon: WorkflowIcon },
            {
                title: "Anúncios",
                href: "/dashboard/announcements",
                icon: MegaphoneIcon,
            },
            {
                title: "Callcenter",
                href: "/dashboard/callcenter",
                icon: HeadsetIcon,
            },
        ],
    },
    {
        label: "Rotas",
        items: [
            { title: "DIDs", href: "/dashboard/dids", icon: HashIcon },
            {
                title: "Rotas de entrada",
                href: "/dashboard/inbound-routes",
                icon: PhoneIncomingIcon,
            },
            {
                title: "Rotas de saída",
                href: "/dashboard/outbound-routes",
                icon: PhoneOutgoingIcon,
            },
            { title: "Troncos", href: "/dashboard/trunks", icon: NetworkIcon },
        ],
    },
    {
        label: "Recursos",
        items: [
            { title: "Áudios", href: "/dashboard/audios", icon: FileAudioIcon },
            {
                title: "Grupos de horário",
                href: "/dashboard/time-groups",
                icon: ClockIcon,
            },
            {
                title: "Condições de horário",
                href: "/dashboard/time-conditions",
                icon: CalendarClockIcon,
            },
            {
                title: "Feriados",
                href: "/dashboard/holiday-groups",
                icon: CalendarDaysIcon,
            },
            {
                title: "Templates de requisição",
                href: "/dashboard/request-templates",
                icon: WebhookIcon,
            },
        ],
    },
]

export function AppSidebar() {
    const pathname = usePathname()
    const { isMobile, setOpenMobile } = useSidebar()
    const { resolvedTheme, setTheme } = useTheme()
    const { logout } = useLogout()

    const isActive = (href: string) =>
        href === "/dashboard" ? pathname === href : pathname.startsWith(href)

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
                    {NAV.map((group) => (
                        <SidebarGroup key={group.label}>
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
                                                        <span>{item.title}</span>
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
                <SidebarSeparator />
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Alternar tema"
                                onClick={() =>
                                    setTheme(
                                        resolvedTheme === "dark" ? "light" : "dark"
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
