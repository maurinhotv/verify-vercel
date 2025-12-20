import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

async function getPayment(paymentId: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!r.ok) throw new Error("Erro ao consultar pagamento MP");
  return r.json();
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId =
      searchParams.get("id") ||
      searchParams.get("data.id") ||
      (await req.json().catch(() => null))?.data?.id;

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const payment = await getPayment(paymentId);

    // Só processa se estiver aprovado
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json({ error: "external_reference ausente" }, { status: 400 });
    }

    // Busca pedido
    const { data: order } = await supabase
      .from("pix_orders")
      .select("id, user_id, package_id, delivered_at")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
    }

    // 🔒 TRAVA ANTI DUPLICAÇÃO
    if (order.delivered_at) {
      return NextResponse.json({ ok: true, alreadyDelivered: true });
    }

    // Busca pacote
    const { data: pkg } = await supabase
      .from("diamond_packages")
      .select("diamonds")
      .eq("id", order.package_id)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "pacote inválido" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1️⃣ MARCA COMO ENTREGUE (atomicamente)
    const { data: updated } = await supabase
      .from("pix_orders")
      .update({
        delivered_at: now,
        paid_at: now,
        status: "delivered",
        gateway_id: String(payment.id),
      })
      .eq("id", order.id)
      .is("delivered_at", null)
      .select("id")
      .single();

    if (!updated) {
      return NextResponse.json({ ok: true, alreadyDelivered: true });
    }

    // 2️⃣ ENTREGA OS DIAMANTES NO SITE (FONTE DA VERDADE)
    await supabase.rpc("increment_diamonds", {
      p_user_id: order.user_id,
      p_amount: pkg.diamonds,
    });

    // 🔜 3️⃣ AQUI É ONDE VOCÊ CHAMA O MTA (PRÓXIMO PASSO)
    // fetch(process.env.MTA_API_URL!, { ... })

    return NextResponse.json({
      ok: true,
      delivered: true,
      diamonds: pkg.diamonds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "webhook error", details: err.message },
      { status: 500 }
    );
  }
}
