import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-prizma-secret");
    if (secret !== process.env.MTA_SHARED_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const account = body?.account;

    if (!account || typeof account !== "string") {
      return NextResponse.json({ ok: false, error: "invalid_account" }, { status: 400 });
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    // Usa users.username (você disse que existe)
    const { data: user, error } = await supabase
      .from("user")
      .select("id, username, diamonds")
      .eq("username", account)
      .single();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, diamonds: user.diamonds ?? 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
