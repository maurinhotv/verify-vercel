// app/api/pix/webhook/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type MPWebhookBody = {
  type?: string; // ex: "payment"
  action?: string; // ex: "payment.updated"
  data?: { id?: string | number };
  id?: string | number; // às vezes vem assim
};

function jsonOk(extra: Record<string, any> = {}) {
  return NextResponse.json({ ok: true, ...extra }, { status: 200 });
}

/**
 * Entrega diamantes via sua API do MTA (server-to-server).
 * Ajuste o payload/header se a sua API esperar outro formato.
 */
async function deliverDiamondsToMTA(params: {
  mtaAccount: string;
  diamonds: number;
  orderId: string;
}) {
  const url = process.env.MTA_API_URL?.trim();
  const secret = process.env.MTA_API_SECRET?.trim();

  if (!url || !secret) {
    throw new Error("MTA_API_URL ou MTA_API_SECRET não definido");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      account: params.mtaAccount,
      diamonds: params.diamonds,
      order_id: params.orderId,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`MTA erro ${res.status}: ${t}`);
  }

  return true;
}

async function fetchMpPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MP_ACCESS_TOKEN não definido");

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(`MP fetch payment falhou: ${res.status} ${JSON.stringify(json)}`);
  }
  return json as any;
}

// Mercado Pago às vezes testa com GET ou você pode abrir no navegador.
// Não pode dar 405.
export async function GET() {
  return jsonOk({ note: "webhook online" });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as MPWebhookBody;

    // tenta pegar id do pagamento de vários jeitos
    const paymentIdRaw = body?.data?.id ?? body?.id;
    const paymentId = paymentIdRaw ? String(paymentIdRaw) : "";

    if (!paymentId) {
      // responde 200 pra evitar retry infinito, mas loga no banco se quiser
      return jsonOk({ ignored: true, reason: "sem payment id" });
    }

    // 1) Confirma no MP (NUNCA confiar só no webhook)
    const payment = await fetchMpPayment(paymentId);

    const status: string = payment?.status; // approved, pending, rejected...
    const externalRef: string | null = payment?.external_reference
      ? String(payment.external_reference)
      : null;

    // Se não tiver external_reference, não tem como achar seu pedido
    if (!externalRef) {
      return jsonOk({ ignored: true, reason: "sem external_reference" });
    }

    // 2) Busca pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .select("id, user_id, package_id, mta_account, status, paid_at, delivered_at, gateway_id, mp_payment_id")
      .eq("id", externalRef)
      .single();

    if (orderErr || !order?.id) {
      return jsonOk({ ignored: true, reason: "pedido não encontrado" });
    }

    // 3) Atualiza status do pedido no banco (sempre)
    // tenta gravar mp_payment_id (se a coluna existir). Se não existir, ignora.
    await supabaseAdmin
      .from("pix_orders")
      .update({
        status: status,
        mp_payment_id: paymentId,
        paid_at: status === "approved" ? new Date().toISOString() : order.paid_at,
      })
      .eq("id", order.id);

    // 4) Só entrega se aprovado
    if (status !== "approved") {
      return jsonOk({ received: true, status });
    }

    // 5) Idempotência: se já entregou, não entrega de novo
    if (order.delivered_at) {
      return jsonOk({ received: true, status, delivered: true, dedup: true });
    }

    // 6) Busca pacote
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, diamonds")
      .eq("id", order.package_id)
      .single();

    if (pkgErr || !pkg?.id) {
      // marca erro, mas responde 200 pra não virar retry infinito
      await supabaseAdmin.from("pix_orders").update({ status: "package_not_found" }).eq("id", order.id);
      return jsonOk({ received: true, status, delivered: false, reason: "pacote não encontrado" });
    }

    const diamonds = Number(pkg.diamonds);
    if (!Number.isFinite(diamonds) || diamonds <= 0) {
      await supabaseAdmin.from("pix_orders").update({ status: "invalid_diamonds" }).eq("id", order.id);
      return jsonOk({ received: true, status, delivered: false, reason: "diamonds inválido" });
    }

    const mtaAccount = String(order.mta_account || "").trim();
    if (!mtaAccount) {
      await supabaseAdmin.from("pix_orders").update({ status: "missing_mta_account" }).eq("id", order.id);
      return jsonOk({ received: true, status, delivered: false, reason: "mta_account vazio" });
    }

    // 7) Entrega no MTA
    await deliverDiamondsToMTA({
      mtaAccount,
      diamonds,
      orderId: String(order.id),
    });

    // 8) Marca como entregue (isso impede duplicar)
    await supabaseAdmin
      .from("pix_orders")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return jsonOk({ received: true, status, delivered: true });
  } catch (e: any) {
    // MUITO importante: webhook não pode ficar dando 500 sempre,
    // senão o MP vai reenviar e pode causar duplicação.
    // Então respondemos 200 e você olha o log do erro.
    console.error("WEBHOOK ERROR:", e?.message ?? e);
    return jsonOk({ received: true, delivered: false, error: e?.message ?? String(e) });
  }
}
