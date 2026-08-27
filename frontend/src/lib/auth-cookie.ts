import Cookies from "universal-cookie"

// Checagem síncrona do cookie `token` usada nos `beforeLoad` de rota - equivalente ao
// middleware/proxy.ts do frontend Next, mas roda no client (SPA sem servidor de rota)
export function hasAuthToken(): boolean {
  return !!new Cookies().get("token")
}
