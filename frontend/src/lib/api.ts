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

// lê o `exp` do próprio JWT em vez de duplicar o TTL do access token (JWT_EXPIRES_IN do backend)
// aqui - evita um segundo ponto de drift além do já existente em schemas/hooks
function decodeJwtExpSeconds(token: string): number | undefined {
  try {
    const payload = token.split(".")[1]
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return typeof exp === "number" ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : undefined
  } catch {
    return undefined
  }
}

// cookie de sessão (sem maxAge) some ao fechar o navegador antes do refreshToken (7d) expirar -
// o guard de rota (auth-cookie.ts) só olha esse cookie e desloga sem tentar refresh nesse caso
export function setAccessTokenCookie(token: string) {
  cookies.set("token", token, {
    path: "/",
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: decodeJwtExpSeconds(token) ?? 15 * 60,
  })
}

async function requestNewToken(): Promise<string> {
  const { data } = await api.post("/auth/refresh")
  setAccessTokenCookie(data.token)
  return data.token as string
}

// refresh compartilhado: várias requests 401 simultâneas na MESMA aba disparam um único
// /auth/refresh (dedupe local via essa promise em voo)
let refreshing: Promise<string> | null = null

// O refreshToken (cookie httpOnly) é de uso único - backend consome o JTI atomicamente e rejeita
// reuso (ver auth.service.ts). Sem coordenação ENTRE abas, duas abas com o access token expirando
// junto (comum: abas abertas na mesma sessão) mandam /auth/refresh quase ao mesmo tempo com o
// mesmo cookie; uma ganha a rotação, a outra recebe 401 "Token revoked" e é deslogada à força -
// mesmo a sessão continuando 100% válida na aba que ganhou. Web Locks API (suportada nos
// browsers evergreen atuais) serializa isso entre abas do mesmo navegador: só uma aba por vez
// entra no bloco abaixo; as que esperavam o lock reaproveitam o token que a vencedora já deixou
// no cookie em vez de tentar rodar o refresh de novo com o refresh token já consumido.
async function refreshTokenAcrossTabs(): Promise<string> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return requestNewToken()
  }

  const tokenBeforeWait = cookies.get("token")
  return navigator.locks.request("sofon-auth-refresh", async () => {
    const current = cookies.get("token")
    if (current && current !== tokenBeforeWait) return current as string
    return requestNewToken()
  })
}

export async function refreshToken(): Promise<string> {
  refreshing ??= refreshTokenAcrossTabs().finally(() => {
    refreshing = null
  })

  try {
    return await refreshing
  } catch (error) {
    // só força logout quando o backend rejeitou a sessão de fato (401) - erro de rede/5xx
    // (ex: Redis fora do ar) é transiente e não pode derrubar o usuário
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      cookies.remove("token", { path: "/" })
      if (typeof window !== "undefined") window.location.href = "/login"
    }
    throw error
  }
}

// rotas de auth que não devem tentar refresh automático em 401 (evita loop) - só as que rodam
// sem sessão prévia; /auth/me e /auth/logout continuam elegíveis pro retry
const NO_RETRY_ROUTES = ["/auth/login", "/auth/refresh", "/auth/register"]

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const isAuthRoute = NO_RETRY_ROUTES.some((route) => original?.url?.startsWith(route))

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
  "Auth service unavailable": "Serviço de autenticação indisponível no momento. Tente novamente em instantes.",
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
