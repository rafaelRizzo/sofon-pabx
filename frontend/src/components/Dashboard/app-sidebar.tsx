import { Link, useLocation } from "@tanstack/react-router"
import {
  ActivityIcon,
  Building2Icon,
  FileAudioIcon,
  FileClockIcon,
  HashIcon,
  HistoryIcon,
  KeyRoundIcon,
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

import { SofonMark } from "@/components/icons/sofon-mark"
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
import { useTheme } from "@/components/theme-provider"
import { useAuth, type PermissionResourceKey } from "@/hooks/use-auth"
import { useLogout } from "@/hooks/use-logout"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  // omitido = sempre visível (ex: Dashboard); presente = precisa de "<permission>:view"
  // (admin/reseller sempre veem tudo, só role "user" é filtrado; ver useAuth().hasPermission)
  permission?: PermissionResourceKey | "cdr" | "audit-logs"
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

// Recursos reutilizáveis são criados e configurados no contexto do Flow, sem poluir a navegação.
// Exportado pra alimentar o breadcrumb do header (DashboardBreadcrumb), única fonte de verdade
// pra rótulos de grupo/página.
export const NAV: NavGroup[] = [
  {
    label: "Visão geral",
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
    label: "Monitoramento",
    items: [
      {
        title: "Tempo real",
        href: "/dashboard/monitoring",
        icon: ActivityIcon,
        permission: "extensions",
      },
    ],
  },
  {
    label: "Telefonia",
    items: [
      {
        title: "Ramais",
        href: "/dashboard/extensions",
        icon: PhoneIcon,
        permission: "extensions",
      },
      {
        title: "DIDs",
        href: "/dashboard/dids",
        icon: HashIcon,
        permission: "dids",
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
    label: "Roteamento",
    items: [
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
    ],
  },
  {
    label: "Automação",
    items: [
      {
        title: "Flows",
        href: "/dashboard/flows",
        icon: WorkflowIcon,
        permission: "flows",
      },
      {
        title: "Áudios",
        href: "/dashboard/audios",
        icon: FileAudioIcon,
        permission: "audios",
      },
      {
        title: "Credenciais de integração",
        href: "/dashboard/integration-credentials",
        icon: KeyRoundIcon,
        permission: "integrations",
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
      {
        title: "Log de auditoria",
        href: "/dashboard/audit-logs",
        icon: HistoryIcon,
        permission: "audit-logs",
      },
    ],
  },
]

export function AppSidebar() {
  const { pathname } = useLocation()
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
            <SofonMark className="size-6 shrink-0 text-primary" />
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
                            to={item.href}
                            onClick={() =>
                              isMobile && setOpenMobile(false)
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Alternar tema"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
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
