import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // NÃO use crypto / bcrypt / supabase / cookies aqui (Edge Runtime).
  // Mantém o site funcionando sem CSRF no middleware.
  return NextResponse.next();
}

// Se você tinha matcher, deixe assim ou apague.
// export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
