// app/api/pix/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs"; // garante Node (não Edge)

function jsonError(status: number, message: string, details?: any) {
  return NextResponse.json(
    { error: message, status, details: details ? JSON.stringify(details) : undefined },
    { status }
  );
}

type Body = {
  packageId?: number;
};

export async function POST(req: Request) {
  try {
    // ✅ FIX DO SEU ERRO: cookies() é Promise
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return jsonError(401, "Não autenticado.");
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const packageId = Number(body.packageId);
    if (!packageId || Number.isNaN(packageId)) {
      return jsonError(400, "Pacote inválido.");
    }

    // ---------------------------------------------------------
    // A partir daqui é o seu fluxo normal de criação do checkout
    // ---------------------------------------------------------

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) return jsonError(500, "MP_ACCESS_TOKEN não definido.");

    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!APP_URL) return jsonError(500, "APP_URL não definido (ex: https://seusite.com).");

    // ⚠️ IMPORTANTE:
    // Aqui eu não tenho acesso ao seu banco/tabelas.
    // Então eu deixei duas partes bem “plugáveis”:
    // 1) Buscar pacote (diamonds/preço)
    // 2) Criar order local (external_reference)
    //
    // Se você já faz isso no seu route atual, COPIE o miolo de DB do seu route
    // e só mantenha o FIX do cookies() + o retorno checkout_url.

    // =========================
    // (A) DEFINA O PREÇO DO PACOTE
    // =========================
    // 🔥 Se no seu código você busca do Supabase, mantenha como está.
    // Aqui vai um fallback simples pra não quebrar build:
    const packages: Record<number, { title: string; unit_price: number; diamonds: number }> = {
      1: { title: "290 Diamantes", unit_price: 69, diamonds: 290 },
      2: { title: "575 Diamantes", unit_price: 129, diamonds: 575 },
      3: { title: "1000 Diamantes", unit_price: 255, diamonds: 1000 },
    };

    const pkg = packages[packageId];
    if (!pkg) return jsonError(400, "Pacote inválido.");

    // =========================
    // (B) CRIE UM ID DE PEDIDO (external_reference)
    // =========================
    // Se você já cria no banco e usa order.id, use isso.
    // Aqui eu uso um id simples pra não travar:
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // =========================
    // (C) CRIA PREFERENCE (CHECKOUT)
    // =========================
    const preferencePayload = {
      external_reference: orderId,
      items: [
        {
          title: pkg.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: pkg.unit_price,
        },
      ],
      back_urls: {
        success: `${APP_URL}/?payment=success`,
        pending: `${APP_URL}/?payment=pending`,
        failure: `${APP_URL}/?payment=failure`,
      },
      auto_return: "approved",
      // notification_url: `${APP_URL}/api/pix/webhook`, // se você usa webhook, habilite aqui
      // metadata: { packageId, diamonds: pkg.diamonds }, // opcional
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json().catch(() => ({} as any));

    if (!mpRes.ok) {
      return jsonError(400, "MP error", mpData);
    }

    const checkoutUrl = mpData?.init_point || mpData?.sandbox_init_point;
    if (!checkoutUrl) {
      return jsonError(500, "Resposta inválida do Mercado Pago (sem init_point).", mpData);
    }

    // ✅ ISSO É O QUE O SEU FRONT ESPERA:
    return NextResponse.json({
      ok: true,
      order_id: orderId,
      checkout_url: checkoutUrl,
    });
  } catch (err: any) {
    return jsonError(500, "Erro inesperado.", { message: err?.message || String(err) });
  }
}
