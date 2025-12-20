import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// EDGE SAFE: não use/importe nada de Node aqui (fs, path, crypto, supabase, bcrypt, __dirname etc)

export function middleware(req: NextRequest) {
  // Só protege o /painel. Se não tiver cookie, manda pra home abrindo login.
  const token = req.cookies.get("session_token")?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("openLogin", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Rodar middleware APENAS no painel (isso evita quebrar / e /favicon.png etc)
export const config = {
  matcher: ["/painel/:path*"],
};
