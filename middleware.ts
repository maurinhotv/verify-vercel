import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Só protege /painel. (matcher embaixo garante isso)
  const token = req.cookies.get("session_token")?.value;

  // Se não tem cookie, manda pro / abrindo login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("openLogin", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// IMPORTANTÍSSIMO: limita o middleware APENAS ao /painel
export const config = {
  matcher: ["/painel/:path*"],
};
