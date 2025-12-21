import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  packageId?: number;
};

function jsonError(status: number, error: string, details?: unknown) {
  const isProd = process.env.NODE_ENV === "production";

  return NextResponse.json(
    {
      error,
      ...(details && !isProd ? { details } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

function toReais(priceCents: number) {
  // Mercado Pago aceita number (ex: 69) ou decimal (ex: 69.9)
  // Se você guarda em centavos, converte aqui.
  return Math.round(priceCents) / 100;
}

export async function POST(req: Request) {
  try {
    const { packageId } = (await req.json().catch(() => ({}))) as Body;

    if (!packageId || typeof packageId !== "number") {
      return jsonError(400, "packageId inválido.");
    }

    // =========================
    // 1) AUTH via cookie session_token
    // Next 15/16: cookies() é async
    // =========================
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return jsonError(401, "Não autenticado.");
    }

    // =========================
    // 2) SUPABASE ADMIN (service role)
    // =========================
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // (mudança mínima: remove redundância)

    if (!serviceRoleKey) {
      return jsonError(
        500,
        "SUPABASE_SERVICE_ROLE_KEY não definido no ambiente da Vercel."
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // =========================
    // 3) Resolve sessão -> user_id
    // =========================
    const { data: sessionRow, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select("user_id")
      .eq("token", sessionToken)
      .single();

    if (sessionErr || !sessionRow?.user_id) {
      return jsonError(401, "Sessão inválida.", sessionErr?.message);
    }

    // =========================
    // 4) Busca usuário
    // =========================
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .eq("id", sessionRow.user_id)
      .single();

    if (userErr || !user) {
      return jsonError(401, "Usuário não encontrado.", userErr?.message);
    }

    // =========================
    // 5) Busca pacote no BD (diamond_packages)
    // =========================
    const { data: pack, error: packErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, name, diamonds, price_cents, active")
      .eq("id", packageId)
      .eq("active", true)
      .single();

    if (packErr || !pack) {
      return jsonError(404, "Pacote não encontrado.", packErr?.message);
    }

    if (!pack.price_cents || pack.price_cents <= 0) {
      return jsonError(500, "Pacote com preço inválido no banco.");
    }

    // =========================
    // 6) Cria pedido local (pix_orders)
    // =========================
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .insert({
        user_id: user.id,
        mta_account: user.username, // mantém como está (você disse que existe)
        package_id: pack.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order?.id) {
      return jsonError(500, "Erro ao criar pedido.", orderErr?.message);
    }

    // =========================
    // 7) Mercado Pago Checkout (Preference)
    // =========================
    const mpAccessToken = requireEnv("MP_ACCESS_TOKEN");
    const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

    const notificationUrl = `${appUrl}/api/pix/webhook`;

    const preferencePayload = {
      items: [
        {
          title: `${pack.name} - ${pack.diamonds} diamantes`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: toReais(pack.price_cents),
        },
      ],
      external_reference: String(order.id),
      back_urls: {
        success: `${appUrl}/?payment=success`,
        pending: `${appUrl}/?payment=pending`,
        failure: `${appUrl}/?payment=failure`,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      statement_descriptor: "PRIZMA",
    };

    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
      }
    );

    const mpData: any = await mpRes.json().catch(() => null);

    if (!mpRes.ok || !mpData?.id || !mpData?.init_point) {
      await supabaseAdmin
        .from("pix_orders")
        .update({ status: "error" })
        .eq("id", order.id);

      return jsonError(
        502,
        "Erro ao gerar checkout no Mercado Pago.",
        mpData ?? "Resposta inválida do MP"
      );
    }

    // =========================
    // 8) Atualiza pedido com gateway_id
    // =========================
    await supabaseAdmin
      .from("pix_orders")
      .update({
        gateway_id: String(mpData.id),
        status: "pending",
      })
      .eq("id", order.id);

    // =========================
    // 9) Retorno para o front
    // =========================
    return NextResponse.json(
      {
        checkout_url: mpData.init_point,
        order_id: order.id,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return jsonError(500, "Erro interno.", e?.message || String(e));
  }
}
