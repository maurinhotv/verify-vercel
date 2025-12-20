import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/server/session";

type Body = { packageId: number };

function getBaseUrl(req: Request) {
  // 1) Se existir APP_URL, usa (produção)
  if (process.env.APP_URL && process.env.APP_URL.startsWith("http")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  // 2) Senão, monta pelo host da requisição (dev/local)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const packageId = Number(body?.packageId);
    if (!packageId || Number.isNaN(packageId)) {
      return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
    }

    // pacote fixo no banco (nunca confiar no client)
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("diamond_packages")
      .select("id, diamonds, price_cents, active")
      .eq("id", packageId)
      .eq("active", true)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
    }

    // cria pedido local
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("pix_orders")
      .insert({
        user_id: user.id,
        mta_account: user.username, // ✅ vínculo com MTA
        package_id: pkg.id,
        status: "pending",
      })
      .select("*")
      .single();

    if (orderErr || !order) {
      console.error("pix_orders insert:", orderErr);
      return NextResponse.json({ error: "Erro ao criar pedido" }, { status: 500 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN ausente" }, { status: 500 });
    }

    const baseUrl = getBaseUrl(req);

    // ✅ ATENÇÃO: é back_urls (com S). NUNCA back_url.
    const preferencePayload = {
      external_reference: String(order.id),
      items: [
        {
          title: `${pkg.diamonds} Diamantes`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(pkg.price_cents) / 100,
        },
      ],
      back_urls: {
        success: `${baseUrl}/diamantes/sucesso`,
        pending: `${baseUrl}/diamantes/pendente`,
        failure: `${baseUrl}/diamantes/erro`,
      },
      // ❌ NÃO use auto_return por enquanto
      notification_url: `${baseUrl}/api/pix/webhook`,
    };
console.log("CREATE ROUTE ATIVOU ✅", new Date().toISOString());
console.log("PAYLOAD MP ✅", preferencePayload);


    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpText = await mpRes.text();

    if (!mpRes.ok) {
      console.error("MP preference error:", mpRes.status, mpText);
      return NextResponse.json({ error: "MP error", details: mpText }, { status: 502 });
    }

    const pref = JSON.parse(mpText);

    // salva preference id
    await supabaseAdmin
      .from("pix_orders")
      .update({ gateway_id: String(pref.id) })
      .eq("id", order.id);

    return NextResponse.json({ checkout_url: pref.init_point });
  } catch (e) {
    console.error("pix/create fatal:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
