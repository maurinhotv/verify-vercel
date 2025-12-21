import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

async function readBody(req: Request): Promise<{ account?: unknown; amount?: unknown; reason?: unknown }> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null);
    return (j && typeof j === "object") ? (j as any) : {};
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return {};
    return { account: fd.get("account"), amount: fd.get("amount"), reason: fd.get("reason") };
  }

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

    const account =
      typeof body.account === "string" ? body.account.trim() : (body.account != null ? String(body.account).trim() : "");
    const amount = Number(body.amount);
    const reason =
      typeof body.reason === "string" ? body.reason.slice(0, 80) : "mta_spend";

    if (!account) {
      return NextResponse.json({ ok: false, error: "invalid_account" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    // 1) Busca usuário
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id, username, diamonds")
      .eq("username", account)
      .single();

    if (uErr || !user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const current = Number(user.diamonds) || 0;
    if (current < amount) {
      return NextResponse.json(
        { ok: false, error: "insufficient_funds", current, needed: amount },
        { status: 409 }
      );
    }

    // 2) Update com proteção simples (compare-and-swap)
    // evita corrida caso duas operações ocorram ao mesmo tempo
    const next = current - amount;

    const { data: updated, error: updErr } = await supabase
      .from("users")
      .update({ diamonds: next })
      .eq("id", user.id)
      .eq("diamonds", current)
      .select("id, diamonds")
      .single();

    if (updErr || !updated) {
      // Em caso de corrida, manda o MTA tentar de novo (ou o admin repetir o comando)
      return NextResponse.json({ ok: false, error: "concurrency_retry" }, { status: 409 });
    }

    return NextResponse.json(
      { ok: true, account: user.username, newBalance: updated.diamonds, spent: amount, reason },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
