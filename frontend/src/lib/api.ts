import axios from "axios"
import Cookies from "universal-cookie"

const cookies = new Cookies()

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  withCredentials: true, // envia o cookie httpOnly refreshToken ao backend
})

api.interceptors.request.use((config) => {
  const token = cookies.get("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// refresh compartilhado: várias requests 401 simultâneas disparam um único /auth/refresh
let refreshing: Promise<string> | null = null

export async function refreshToken(): Promise<string> {
  refreshing ??= api
    .post("/auth/refresh")
    .then(({ data }) => {
      cookies.set("token", data.token, {
        path: "/",
        sameSite: "lax",
        secure: import.meta.env.PROD,
      })
      return data.token as string
    })
    .finally(() => {
      refreshing = null
    })

  try {
    return await refreshing
  } catch (error) {
    cookies.remove("token", { path: "/" })
    if (typeof window !== "undefined") window.location.href = "/login"
    throw error
  }
}

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
        const token = await refreshToken()
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch {
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// mensagens técnicas padrão que vazam em inglês de middlewares (auth/role/scope) - sempre
// as mesmas strings, então dá pra traduzir com segurança sem mexer em cada controller
const KNOWN_MESSAGES: Record<string, string> = {
  Unauthorized: "Sessão expirada. Faça login novamente.",
  Forbidden: "Você não tem permissão para executar essa ação.",
  "Token revoked": "Sua sessão foi revogada. Faça login novamente.",
  "Internal server error": "Erro interno do servidor. Tente novamente mais tarde.",
  "Validation error": "Dados inválidos. Verifique os campos e tente novamente.",
  "Not Found": "Recurso não encontrado.",
  "Bad Request": "Requisição inválida.",
}

// fallback por status quando o backend não manda message (rede fora do ar, erro não tratado, etc)
const STATUS_FALLBACK: Record<number, string> = {
  400: "Requisição inválida. Verifique os dados enviados.",
  401: "Sessão expirada. Faça login novamente.",
  403: "Você não tem permissão para executar essa ação.",
  404: "Recurso não encontrado.",
  408: "Tempo de resposta esgotado. Tente novamente.",
  409: "Conflito: esse recurso já existe ou está em uso.",
  413: "Arquivo ou dados enviados são grandes demais.",
  422: "Dados inválidos. Verifique os campos e tente novamente.",
  429: "Muitas requisições. Aguarde um instante e tente novamente.",
  500: "Erro interno do servidor. Tente novamente mais tarde.",
  502: "Servidor indisponível no momento. Tente novamente.",
  503: "Serviço indisponível no momento. Tente novamente.",
  504: "Tempo de resposta do servidor esgotado. Tente novamente.",
}

type ApiErrorBody = {
  message?: string
  errors?: Array<{ message?: string; path?: Array<string | number> }>
}

// extrai uma mensagem em pt-br de qualquer erro de request. Prioridade:
// 1) erros de validação (zod) vindos do backend, 2) mensagem conhecida traduzida,
// 3) mensagem original do backend (já costuma vir em pt-br dos services), 4) fallback por status,
// 5) erro de rede/timeout (sem response), 6) undefined pra quem chamar decidir o fallback
export function getErrorMessage(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined

  if (!err.response) {
    if (err.code === "ECONNABORTED")
      return "Tempo de resposta esgotado. Verifique sua conexão e tente novamente."
    if (err.code === "ERR_NETWORK")
      return "Não foi possível conectar ao servidor. Verifique sua internet."
    return "Falha de conexão com o servidor. Tente novamente."
  }

  const { status, data } = err.response
  const body = data as ApiErrorBody | undefined

  if (body?.errors?.length) {
    const messages = body.errors
      .slice(0, 3)
      .map((e) => e.message)
      .filter((m): m is string => Boolean(m))
    if (messages.length) return messages.join(" | ")
  }

  // "Route GET:/foo not found" - 404 padrão do Fastify pra rota inexistente (endpoint não
  // registrado, typo na URL); nunca uma mensagem pensada pro usuário final, sempre cai no fallback
  const isRawRouteNotFound = status === 404 && /^Route .+ not found$/i.test(body?.message ?? "")

  if (body?.message && !isRawRouteNotFound) return KNOWN_MESSAGES[body.message] ?? body.message

  return STATUS_FALLBACK[status] ?? "Erro inesperado. Tente novamente."
}

export const apiError = (err: unknown, fallback: string): string =>
  getErrorMessage(err) ?? fallback

// 4xx = rejeição definitiva do backend (validação, permissão, recurso inexistente) - nunca vai
// vingar só de tentar de novo. 5xx/rede seguem sendo tratados como transiente por quem chama.
export const isValidationError = (err: unknown): boolean => {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined
  return status !== undefined && status >= 400 && status < 500
}
