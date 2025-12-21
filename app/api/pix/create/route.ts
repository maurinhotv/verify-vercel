// app/api/pix/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  packageId?: number;
};

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(
    { error, ...(details ? { details } : {}) },
    { status }
  );
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definido`);
  return v;
}

function moneyFromCents(cents: number) {
  // Mercado Pago espera number em reais (ex: 69.90)
  return Math.round(Number(cents)) / 100;
}

export async function POST(req: Request) {
  try {
    const { packageId }: Body = await req.json().catch(() => ({}));

    if (!packageId || typeof packageId !== "number") {
      return jsonError(400, "packageId inválido");
    }

    // =========================
    // 1) AUTH (cookie session_token)
    // =========================
    // Next 16: cookies() pode ser async
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return jsonError(401, "Não autenticado.");
    }

    // =========================
    // 2) SUPABASE ADMIN
    // =========================
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // pega sessão
    const { data: sessionRow, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select("user_id, token")
      .eq("token", sessionToken)
      .single();

    if (sessionErr || !sessionRow?.user_id) {
      return jsonError(401, "Sessão inválida.", sessionErr?.message);
    }

    // pega user (não usa mta_account!)
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .eq("id", sessionRow.user_id)
      .single();

    if (userErr || !user) {
      return jsonError(401, "Usuário não encontrado.", userErr?.message);
    }

    // =========================
    // 3) BUSCA PACOTE NO BANCO
    // =========================
    const { data: pack, error: packErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, name, diamonds, price_cents, active")
      .eq("id", packageId)
      .single();

    if (packErr || !pack) {
      return jsonError(404, "Pacote não encontrado.", packErr?.message);
    }

    if (!pack.active) {
      return jsonError(400, "Pacote indisponível.");
    }

    const priceCents = Number(pack.price_cents) || 0;
    if (priceCents <= 0) {
      return jsonError(400, "Preço inválido para este pacote.");
    }

    // =========================
    // 4) CRIA PEDIDO LOCAL (pix_orders)
    // =========================
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .insert({
        user_id: user.id,
        mta_account: user.username, // mantém compatibilidade com sua tabela
        package_id: pack.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order?.id) {
      return jsonError(500, "Erro ao criar pedido", orderErr?.message);
    }

    // =========================
    // 5) MERCADO PAGO CHECKOUT (Preference)
    // =========================
    const mpToken = requireEnv("MP_ACCESS_TOKEN");
    const appUrl = requireEnv("APP_URL"); // ex: https://seusite.com

    // URLs de retorno (ajuste se você tiver páginas específicas)
    const successUrl = `${appUrl}/diamantes?status=success`;
    const failureUrl = `${appUrl}/diamantes?status=failure`;
    const pendingUrl = `${appUrl}/diamantes?status=pending`;

    // webhook (se você usa)
    const notificationUrl = `${appUrl}/api/pix/webhook`;

    const preferenceBody = {
      external_reference: String(order.id),
      items: [
        {
          id: String(pack.id),
          title: `Diamantes - ${pack.name}`,
          description: `${pack.diamonds} diamantes`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: moneyFromCents(priceCents),
        },
      ],
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData: any = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok || !mpData?.id || !(mpData?.init_point || mpData?.sandbox_init_point)) {
      // marca pedido como erro (não quebra nada se não existir a coluna)
      await supabaseAdmin
        .from("pix_orders")
        .update({ status: "error" })
        .eq("id", order.id);

      return jsonError(
        502,
        "Erro ao gerar checkout no Mercado Pago.",
        mpData
      );
    }

    // salva id da preferência no gateway_id (útil pro webhook)
    await supabaseAdmin
      .from("pix_orders")
      .update({
        gateway_id: String(mpData.id),
      })
      .eq("id", order.id);

    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point;

    // =========================
    // 6) RESPONDE PRO FRONT
    // =========================
    return NextResponse.json({
      ok: true,
      order_id: order.id,
      checkout_url: checkoutUrl,
    });
  } catch (e: any) {
    return jsonError(500, "Erro inesperado ao criar checkout.", e?.message ?? String(e));
  }
}
