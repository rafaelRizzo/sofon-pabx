"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Cookies from "universal-cookie"

import { api } from "@/lib/api"

export function useLogout() {
    const router = useRouter()
    const cookies = new Cookies()

    const logout = async () => {
        try {
            await api.post("/auth/logout")
        } catch {
            // mesmo se a revogação falhar, encerra a sessão local
        } finally {
            cookies.remove("token", { path: "/" })
            toast.success("Sessão encerrada")
            router.push("/login")
        }
    }

    return { logout }
}
