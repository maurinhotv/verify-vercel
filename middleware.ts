import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignora arquivos internos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Protege apenas /painel
  if (pathname.startsWith("/painel")) {
    const token = req.cookies.get("session_token")?.value;

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("login", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
