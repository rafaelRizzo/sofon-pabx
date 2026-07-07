import { NextRequest, NextResponse } from "next/server"

export function proxy(req: NextRequest) {
    const token = req.cookies.get("token")?.value
    const { pathname } = req.nextUrl

    const isAuthPage = pathname === "/" || pathname === "/login"

    // logado → bloqueia páginas de auth
    if (token && isAuthPage) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // não logado → protege dashboard
    if (!token && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/login", req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/", "/login", "/dashboard/:path*"],
}
