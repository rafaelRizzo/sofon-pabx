"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import Cookies from "universal-cookie"

import { api, apiError } from "@/lib/api"

type LoginForm = {
    username: string
    password: string
}

export function useLogin() {
    const router = useRouter()
    const cookies = new Cookies()

    const form = useForm<LoginForm>({
        defaultValues: { username: "", password: "" },
    })

    const onSubmit = form.handleSubmit(async (data) => {
        const id = toast.loading("Entrando...")
        try {
            const { data: res } = await api.post("/auth/login", data)
            cookies.set("token", res.token, { path: "/", sameSite: "lax" })
            toast.success("Login realizado", { id })
            router.push("/dashboard")
        } catch (err) {
            toast.error(apiError(err, "Erro ao realizar login"), { id })
        }
    })

    return { ...form, onSubmit }
}
