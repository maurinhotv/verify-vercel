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
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "MP token missing" }, { status: 500 });
    }

    // MP manda JSON tipo:
    // { "action": "payment.updated", "api_version": "v1", "data": { "id": "123" }, "type": "payment" }
    const body = await req.json().catch(() => null);

    const paymentId =
      body?.data?.id ??
      body?.id ??
      body?.resource?.split?.("/")?.pop?.() ??
      null;

    if (!paymentId) {
      // Sem id, não tem o que fazer (mas responde 200 pro MP não ficar reenviando loucamente)
      return NextResponse.json({ ok: true, ignored: "no_payment_id" });
    }

    // ✅ Busca os detalhes reais do pagamento
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!mpRes.ok) {
      const t = await mpRes.text();
      // responde 200 pro MP não “martelar”, mas loga como erro no seu endpoint (vai aparecer na Vercel)
      return NextResponse.json({ ok: true, mp_fetch_failed: true, details: t });
    }

    const payment = await mpRes.json();

    // Só entrega se estiver aprovado
    const status = String(payment?.status || "");
    if (status !== "approved") {
      return NextResponse.json({ ok: true, not_approved: status });
    }

    // Você setou external_reference = order.id no create
    const externalReference = String(payment?.external_reference || "");
    if (!externalReference) {
      return NextResponse.json({ ok: true, ignored: "no_external_reference" });
    }

    // ✅ 1) Pega o pedido no seu banco
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .select("id, user_id, package_id, delivered_at, status")
      .eq("id", externalReference)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ ok: true, ignored: "order_not_found" });
    }

    // ✅ Idempotência: se já entregou, NÃO entrega de novo
    if (order.delivered_at) {
      return NextResponse.json({ ok: true, already_delivered: true });
    }

    // ✅ 2) Pega quantos diamantes esse pacote dá
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, diamonds")
      .eq("id", order.package_id)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ ok: true, ignored: "package_not_found" });
    }

    const diamondsToAdd = Number(pkg.diamonds) || 0;
    if (diamondsToAdd <= 0) {
      return NextResponse.json({ ok: true, ignored: "invalid_diamonds" });
    }

    /**
     * ✅ Parte mais importante:
     * Primeiro “marca como entregue” somente se delivered_at ainda é null.
     * Se duas notificações chegarem juntas, só 1 vai conseguir atualizar.
     */
    const { data: deliveredRow, error: deliverErr } = await supabaseAdmin
      .from("pix_orders")
      .update({
        status: "delivered",
        paid_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        gateway_id: String(paymentId),
      })
      .eq("id", order.id)
      .is("delivered_at", null)
      .select("id, user_id")
      .single();

    if (deliverErr || !deliveredRow) {
      // Se não atualizou, provavelmente outra requisição já entregou (idempotência)
      return NextResponse.json({ ok: true, already_delivered_race: true });
    }

    // ✅ 3) Agora soma os diamantes no usuário
    // ATENÇÃO: aqui eu estou assumindo que sua tabela users tem uma coluna "diamonds"
    // Se o nome for outro, troque aqui.
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, diamonds")
      .eq("id", deliveredRow.user_id)
      .single();

    if (userErr || !userRow) {
      // Pedido ficou marcado como entregue, mas usuário não encontrado
      // (se isso acontecer, você precisa ajustar user_id no create)
      return NextResponse.json({ ok: true, delivered_but_user_missing: true });
    }

    const current = Number(userRow.diamonds) || 0;
    const next = current + diamondsToAdd;

    const { error: updErr } = await supabaseAdmin
      .from("users")
      .update({ diamonds: next })
      .eq("id", userRow.id);

    if (updErr) {
      // Ainda assim responde ok pro MP, mas você vai ver no log
      return NextResponse.json({ ok: true, delivered_but_update_failed: true });
    }

    return NextResponse.json({ ok: true, delivered: true, added: diamondsToAdd, newBalance: next });
  } catch (e: any) {
    // responde 200 pra não ficar reenvio infinito do MP, mas informa no body
    return NextResponse.json({ ok: true, error: "webhook_exception", details: String(e?.message || e) });
  }
}
