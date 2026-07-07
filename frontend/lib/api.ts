import axios from "axios"
import Cookies from "universal-cookie"

const cookies = new Cookies()

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333",
    withCredentials: true, // envia o cookie httpOnly refreshToken ao backend
})

api.interceptors.request.use((config) => {
    const token = cookies.get("token")
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// refresh compartilhado: várias requests 401 simultâneas disparam um único /auth/refresh
let refreshing: Promise<string> | null = null

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config
        const isAuthRoute = original?.url?.includes("/auth/")

        if (
            error.response?.status === 401 &&
            original &&
            !original._retry &&
            !isAuthRoute
        ) {
            original._retry = true
            try {
                refreshing ??= api
                    .post("/auth/refresh")
                    .then(({ data }) => {
                        cookies.set("token", data.token, {
                            path: "/",
                            sameSite: "lax",
                        })
                        return data.token as string
                    })
                    .finally(() => {
                        refreshing = null
                    })

                const token = await refreshing
                original.headers.Authorization = `Bearer ${token}`
                return api(original)
            } catch {
                cookies.remove("token", { path: "/" })
                if (typeof window !== "undefined")
                    window.location.href = "/login"
            }
        }

        return Promise.reject(error)
    }
)

export const apiError = (err: unknown, fallback: string): string =>
    (axios.isAxiosError(err) && err.response?.data?.message) || fallback
