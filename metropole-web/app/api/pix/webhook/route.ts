import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

// (opcional) segredo de webhook se você quiser validar assinatura depois
// const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

async function fetchPayment(paymentId: string) {
  const accessToken = process.env.MP_ACCESS_TOKEN!;
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}

export async function POST(req: Request) {
  try {
    // Mercado Pago manda JSON em alguns casos, e em outros manda querystring.
    // Vamos aceitar ambos.
    const url = new URL(req.url);
    const qPaymentId = url.searchParams.get("id");
    const qTopic = url.searchParams.get("topic") || url.searchParams.get("type");

    const body = await req.json().catch(() => null);

    let paymentId: string | null = null;

    // Formato comum: { type: "payment", data: { id: "123" } }
    if (body?.type === "payment" && body?.data?.id) {
      paymentId = String(body.data.id);
    }

    // Alguns formatos: { action, api_version, data: { id } }
    if (!paymentId && body?.data?.id) {
      paymentId = String(body.data.id);
    }

    // Fallback via query
    if (!paymentId && qPaymentId && (qTopic === "payment" || qTopic === "payments")) {
      paymentId = String(qPaymentId);
    }

    // Se não for evento de pagamento, só responde OK
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // 1) Confirma no MP server-to-server
    const pay = await fetchPayment(paymentId);
    if (!pay) return NextResponse.json({ ok: true });

    // Precisa estar aprovado
    if (pay.status !== "approved") return NextResponse.json({ ok: true });

    // Seu orderId vem do external_reference (definido no create)
    const orderId = String(pay.external_reference || "");
    if (!orderId) return NextResponse.json({ ok: true });

    // 2) Busca pedido no Supabase
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .select("id, status, user_id, package_id, mta_account, gateway_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return NextResponse.json({ ok: true });

    // Idempotência: se já entregou, não faz nada
    if (order.status === "delivered") return NextResponse.json({ ok: true });

    // 3) Valida valor contra o pacote (anti-fraude)
    const { data: pkg } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, diamonds, price_cents")
      .eq("id", order.package_id)
      .single();

    if (!pkg) return NextResponse.json({ ok: true });

    const expected = Number(pkg.price_cents) / 100;
    const amount = Number(pay.transaction_amount || 0);

    if (amount !== expected) {
      // valor não bate → não entrega
      return NextResponse.json({ ok: true });
    }

    // 4) Marca pago (se ainda não estiver)
    if (order.status !== "paid") {
      await supabaseAdmin
        .from("pix_orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          gateway_id: String(paymentId), // salva paymentId real também
        })
        .eq("id", order.id);
    }

    // 5) Credita diamantes no site (espelho)
    //    Isso permite o Header mostrar saldo.
    //    (Você ainda vai entregar no MTA depois via API secreta)
    const diamondsToAdd = Number(pkg.diamonds);

    // increment atômico
    const { error: incErr } = await supabaseAdmin.rpc("increment_user_diamonds", {
      p_user_id: order.user_id,
      p_amount: diamondsToAdd,
    });

    // Se você ainda não criou a RPC, cai pro update simples:
    if (incErr) {
      // fallback (menos ideal que RPC, mas funciona)
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("diamonds")
        .eq("id", order.user_id)
        .single();

      const current = Number(u?.diamonds ?? 0);
      await supabaseAdmin
        .from("users")
        .update({ diamonds: current + diamondsToAdd })
        .eq("id", order.user_id);
    }

    // 6) Aqui entrará a entrega no MTA (server-to-server) quando você quiser
    // - chamar MTA_API_URL com HMAC e orderId, mtaAccount, diamonds
    // - se MTA ok => marcar delivered

    await supabaseAdmin
      .from("pix_orders")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook fatal", e);
    return NextResponse.json({ ok: true });
  }
}
