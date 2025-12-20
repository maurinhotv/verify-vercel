import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware roda no EDGE: NÃO importe supabase, bcrypt, crypto etc.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignora rotas que não precisam
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Protege o painel (checa só existência do cookie)
  if (pathname.startsWith("/painel")) {
    const token = req.cookies.get("session_token")?.value;

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("openLogin", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
