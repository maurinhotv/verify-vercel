import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  packageId?: number;
};

function jsonError(status: number, error: string, details?: any) {
  return NextResponse.json(
    {
      error,
      ...(details ? { details: typeof details === "string" ? details : JSON.stringify(details) } : {}),
    },
    { status }
  );
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

export async function POST(req: Request) {
  try {
    // ===== ENV =====
    const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const MP_ACCESS_TOKEN = requireEnv("MP_ACCESS_TOKEN");
    const APP_URL = requireEnv("APP_URL"); // ex: https://seusite.vercel.app

    // ===== BODY =====
    const body = (await req.json().catch(() => ({}))) as Body;
    const packageId = Number(body?.packageId);
    if (!packageId) return jsonError(400, "Pacote inválido");

    // ===== AUTH (cookie) =====
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) return jsonError(401, "Não autenticado.");

    // ===== SUPABASE (admin) =====
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1) valida sessão -> pega usuário
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("token", sessionToken)
      .single();

    if (sessionErr || !sessionRow?.user_id) return jsonError(401, "Sessão inválida.");

    const userId = sessionRow.user_id;

    // 2) pega pacote (fonte da verdade do valor e diamonds)
    const { data: pkg, error: pkgErr } = await supabase
      .from("diamond_packages")
      .select("id, diamonds, price_cents, active")
      .eq("id", packageId)
      .eq("active", true)
      .single();

    if (pkgErr || !pkg) return jsonError(400, "Pacote inválido");

    // 3) cria pedido local (pending)
    const { data: order, error: orderErr } = await supabase
      .from("pix_orders")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        status: "pending",
        diamonds: pkg.diamonds,
        price_cents: pkg.price_cents,
      })
      .select("*")
      .single();

    if (orderErr || !order) return jsonError(500, "Erro ao criar pedido");

    // ===== MERCADO PAGO: cria Preference (Checkout) =====
    const unitPrice = Number(pkg.price_cents) / 100;

    const mpPayload = {
      external_reference: String(order.id),
      items: [
        {
          title: `${pkg.diamonds} Diamantes`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: unitPrice,
        },
      ],
      back_urls: {
        success: `${APP_URL}/?payment=success&order=${order.id}`,
        pending: `${APP_URL}/?payment=pending&order=${order.id}`,
        failure: `${APP_URL}/?payment=failure&order=${order.id}`,
      },
      auto_return: "approved",
      notification_url: `${APP_URL}/api/pix/webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpPayload),
    });

    const mpText = await mpRes.text();

    if (!mpRes.ok) {
      // guarda erro pra debug
      await supabase.from("pix_orders").update({ status: "error" }).eq("id", order.id);
      return jsonError(400, "MP error", mpText);
    }

    const mpJson = JSON.parse(mpText);

    const checkoutUrl: string | undefined =
      mpJson?.init_point || mpJson?.sandbox_init_point || mpJson?.checkout_url;

    if (!checkoutUrl) {
      await supabase.from("pix_orders").update({ status: "error" }).eq("id", order.id);
      return jsonError(500, "MP error", "Resposta do MP sem init_point");
    }

    // salva preference_id (ajuda no webhook depois)
    await supabase
      .from("pix_orders")
      .update({
        mp_preference_id: mpJson?.id ?? null,
      })
      .eq("id", order.id);

    // ✅ O FRONT PRECISA DISSO:
    return NextResponse.json({
      checkout_url: checkoutUrl,
      order_id: order.id,
    });
  } catch (e: any) {
    return jsonError(500, "Erro interno", e?.message ?? String(e));
  }
}
