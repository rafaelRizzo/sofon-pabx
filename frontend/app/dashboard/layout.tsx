import { AppSidebar } from "@/components/Dashboard/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0">
                <header className="flex h-12 items-center border-b px-4">
                    <SidebarTrigger />
                </header>
                <main className="min-w-0 flex-1 overflow-x-hidden p-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
