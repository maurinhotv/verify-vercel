import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ✅ Supabase Admin (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;

/**
 * MP às vezes “bate” com GET (teste/validação/robôs).
 * Pra não ficar 405 no log, devolve 200.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  try {
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "MP token missing" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => null);

    const paymentId =
      body?.data?.id ??
      body?.id ??
      body?.resource?.split?.("/")?.pop?.() ??
      null;

    if (!paymentId) {
      return NextResponse.json(
        { ok: true, ignored: "no_payment_id" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 🔎 Busca pagamento real no MP
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!mpRes.ok) {
      const t = await mpRes.text();
      return NextResponse.json(
        { ok: true, mp_fetch_failed: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const payment = await mpRes.json();

    if (String(payment?.status) !== "approved") {
      return NextResponse.json(
        { ok: true, not_approved: payment?.status },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const externalReference = String(payment?.external_reference || "");
    if (!externalReference) {
      return NextResponse.json(
        { ok: true, ignored: "no_external_reference" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Pedido
    const { data: order } = await supabaseAdmin
      .from("pix_orders")
      .select("id, user_id, package_id, delivered_at")
      .eq("id", externalReference)
      .single();

    if (!order || order.delivered_at) {
      return NextResponse.json(
        { ok: true, already_delivered: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Pacote
    const { data: pkg } = await supabaseAdmin
      .from("diamond_packages")
      .select("diamonds")
      .eq("id", order.package_id)
      .single();

    const diamondsToAdd = Number(pkg?.diamonds) || 0;
    if (diamondsToAdd <= 0) {
      return NextResponse.json(
        { ok: true, ignored: "invalid_diamonds" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 🔒 Trava idempotente
    const { data: deliveredRow } = await supabaseAdmin
      .from("pix_orders")
      .update({
        status: "delivered",
        paid_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        gateway_id: String(paymentId),
      })
      .eq("id", order.id)
      .is("delivered_at", null)
      .select("user_id")
      .single();

    if (!deliveredRow) {
      return NextResponse.json(
        { ok: true, already_delivered_race: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 💎 Soma de diamonds com proteção simples contra race
    for (let i = 0; i < 2; i++) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, diamonds")
        .eq("id", deliveredRow.user_id)
        .single();

      if (!user) break;

      const current = Number(user.diamonds) || 0;
      const next = current + diamondsToAdd;

      const { data: updated } = await supabaseAdmin
        .from("users")
        .update({ diamonds: next })
        .eq("id", user.id)
        .eq("diamonds", current)
        .select("id")
        .single();

      if (updated) {
        return NextResponse.json(
          { ok: true, delivered: true, added: diamondsToAdd, newBalance: next },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    return NextResponse.json(
      { ok: true, delivered_but_update_failed: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      isProd
        ? { ok: true, error: "webhook_exception" }
        : { ok: true, error: "webhook_exception", details: String(e?.message || e) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
