import Cookies from "universal-cookie"
import { refreshToken } from "./api"

const cookies = new Cookies()

const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000]

type EventStreamOptions<T> = {
    url: string
    params?: Record<string, string | undefined>
    onMessage: (data: T) => void
}

// EventSource nativo não deixa mandar header Authorization, e a API não aceita cookie (só Bearer,
// ver lib/api.ts) — por isso usa fetch()+ReadableStream (mesmo padrão de auth do resto do app, sem
// vazar token na query string) e reimplementa reconexão com backoff, que o EventSource faria sozinho.
// Retorna uma função pra fechar a conexão (chamar no cleanup do useEffect).
export function openEventStream<T>({ url, params, onMessage }: EventStreamOptions<T>): () => void {
    const controller = new AbortController()
    let stopped = false
    let backoffIdx = 0

    const buildUrl = () => {
        const base = import.meta.env.VITE_API_URL || "http://localhost:3333"
        const qs = new URLSearchParams()
        for (const [key, value] of Object.entries(params ?? {})) {
            if (value) qs.set(key, value)
        }
        const query = qs.toString()
        return `${base}${url}${query ? `?${query}` : ""}`
    }

    const reconnect = () => {
        if (stopped) return
        const delay = BACKOFF_STEPS_MS[Math.min(backoffIdx, BACKOFF_STEPS_MS.length - 1)]!
        backoffIdx += 1
        setTimeout(() => {
            void connect()
        }, delay)
    }

    async function connect() {
        if (stopped) return
        const token = cookies.get("token")

        try {
            const res = await fetch(buildUrl(), {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: controller.signal,
            })

            if (res.status === 401) {
                await refreshToken()
                return connect()
            }
            if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`)

            backoffIdx = 0
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (!stopped) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                let separatorIdx
                while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
                    const rawEvent = buffer.slice(0, separatorIdx)
                    buffer = buffer.slice(separatorIdx + 2)
                    const dataLine = rawEvent
                        .split("\n")
                        .find((line) => line.startsWith("data: "))
                    if (!dataLine) continue // comentário de heartbeat (":\n\n") ou linha vazia
                    try {
                        onMessage(JSON.parse(dataLine.slice(6)) as T)
                    } catch {
                        // evento malformado, ignora esse frame em vez de derrubar a conexão inteira
                    }
                }
            }

            if (!stopped) reconnect()
        } catch {
            if (!stopped && !controller.signal.aborted) reconnect()
        }
    }

    void connect()

    return () => {
        stopped = true
        controller.abort()
    }
}
