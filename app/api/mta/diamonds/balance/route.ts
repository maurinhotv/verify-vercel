import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

async function readBody(req: Request): Promise<{ account?: unknown }> {
  const ct = req.headers.get("content-type") || "";

  // JSON
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null);
    return (j && typeof j === "object") ? (j as any) : {};
  }

  // Form
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return {};
    return { account: fd.get("account") };
  }

  // fallback: tenta JSON mesmo assim
  const j = await req.json().catch(() => null);
  return (j && typeof j === "object") ? (j as any) : {};
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-prizma-secret");
    if (secret !== process.env.MTA_SHARED_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);

    // aceita account como string ou como algo convertível
    const accountRaw = body?.account;
    const account =
      typeof accountRaw === "string"
        ? accountRaw.trim()
        : (accountRaw != null ? String(accountRaw).trim() : "");

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "invalid_account", received: accountRaw ?? null },
        { status: 400 }
      );
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    const { data: user, error } = await supabase
      .from("users")
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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
