// app/api/pix/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

type MpPayment = {
  id: number;
  status: string; // approved, pending, rejected...
  external_reference?: string; // vamos usar como orderId
  transaction_amount?: number;
};

async function fetchMpPayment(paymentId: string): Promise<MpPayment> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`MP GET payment failed: ${r.status} ${txt}`);
  }

  return (await r.json()) as MpPayment;
}

function isPaid(status: string) {
  return status === "approved";
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
    }
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN missing" }, { status: 500 });
    }

    // Mercado Pago normalmente manda id pelo querystring:
    // /api/pix/webhook?id=123&topic=payment
    // (às vezes vem no body também)
    const { searchParams } = new URL(req.url);
    const qsId = searchParams.get("id") || searchParams.get("data.id");

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // sem body, ok
    }

    const bodyId = body?.data?.id ?? body?.id;
    const paymentId = String(qsId ?? bodyId ?? "");

    if (!paymentId || paymentId === "undefined" || paymentId === "null") {
      // Se não veio ID, não tem como processar.
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    // 1) Busca detalhes do pagamento no MP (fonte da verdade)
    const payment = await fetchMpPayment(paymentId);

    // 2) Só processa quando realmente estiver pago
    if (!isPaid(payment.status)) {
      return NextResponse.json({ ok: true, status: payment.status }, { status: 200 });
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json(
        { error: "payment.external_reference missing" },
        { status: 400 }
      );
    }

    // 3) Carrega pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .select("id, user_id, package_id, status, delivered_at")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }

    // 4) TRAVA anti-duplicação: se já entregou, não faz nada
    if (order.delivered_at || order.status === "delivered") {
      return NextResponse.json({ ok: true, alreadyDelivered: true }, { status: 200 });
    }

    // 5) Busca pacote (quantidade de diamantes)
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, diamonds")
      .eq("id", order.package_id)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: "package not found" }, { status: 400 });
    }

    // 6) Marca como entregue de forma CONDICIONAL (só se delivered_at ainda for null)
    // Isso garante que mesmo com 2 webhooks simultâneos, só 1 vai “ganhar”.
    const nowIso = new Date().toISOString();

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("pix_orders")
      .update({
        status: "delivered",
        paid_at: nowIso,
        delivered_at: nowIso,
        gateway_id: String(payment.id),
      })
      .eq("id", order.id)
      .is("delivered_at", null)
      .select("id")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: "failed to update order", details: String(updErr) }, { status: 500 });
    }

    // Se não atualizou nada, significa que outra chamada já entregou.
    if (!updated) {
      return NextResponse.json({ ok: true, alreadyDelivered: true }, { status: 200 });
    }

    // 7) Entrega os diamantes (AQUI é onde você chama sua lógica de crédito real)
    // Se seu /user/balance soma pedidos entregues, só marcar delivered já resolve o header.
    //
    // Se você também tem uma entrega no MTA/servidor do jogo, CHAME APENAS AQUI.
    // Exemplo (se existir um endpoint seu):
    // await fetch(`${process.env.APP_URL}/api/mta/add-diamonds`, { ... });

    return NextResponse.json(
      { ok: true, delivered: true, diamonds: pkg.diamonds, orderId: order.id, paymentId: payment.id },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "webhook error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
