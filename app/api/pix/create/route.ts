import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type CreateBody = {
  packageId: number;
};

// Pacotes (iguais aos do layout)
const PACKAGES: Record<number, { diamonds: number; price: number }> = {
  1: { diamonds: 290, price: 69 },
  2: { diamonds: 575, price: 129 },
  3: { diamonds: 1000, price: 255 },
};

function jsonError(status: number, message: string, extra?: any) {
  return NextResponse.json(
    { error: message, ...(extra ? { extra } : {}) },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    // ✅ auth (seu front já trata 401 abrindo modal)
    const sessionToken = cookies().get("session_token")?.value;
    if (!sessionToken) {
      return jsonError(401, "Não autenticado.");
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
      return jsonError(500, "MP_ACCESS_TOKEN não definido.");
    }

    const APP_URL = process.env.APP_URL;
    if (!APP_URL) {
      return jsonError(500, "APP_URL não definido.");
    }

    const body = (await req.json().catch(() => null)) as CreateBody | null;
    const packageId = Number(body?.packageId);

    if (!packageId || !PACKAGES[packageId]) {
      return jsonError(400, "packageId inválido.");
    }

    const pack = PACKAGES[packageId];

    // ✅ referência para o webhook conseguir relacionar depois
    // (não expõe segredo, é só um identificador)
    const external_reference = `st:${sessionToken}|pkg:${packageId}`;

    // ✅ cria preference (checkout)
    const prefPayload = {
      items: [
        {
          title: `${pack.diamonds} Diamantes`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: pack.price,
        },
      ],
      external_reference,
      // Voltar pro site depois do pagamento (você pode ajustar rotas)
      back_urls: {
        success: `${APP_URL}/?s=diamantes`,
        pending: `${APP_URL}/?s=diamantes`,
        failure: `${APP_URL}/?s=diamantes`,
      },
      auto_return: "approved",
      // ✅ webhook
      notification_url: `${APP_URL}/api/pix/webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prefPayload),
    });

    const mpData = await mpRes.json().catch(() => ({} as any));

    if (!mpRes.ok) {
      return jsonError(500, "Falha ao criar checkout no Mercado Pago.", {
        status: mpRes.status,
        mp: mpData,
      });
    }

    // Mercado Pago costuma retornar init_point (produção) e sandbox_init_point
    const checkout_url = mpData?.init_point || mpData?.sandbox_init_point;

    if (!checkout_url) {
      return jsonError(500, "Mercado Pago não retornou init_point.", { mp: mpData });
    }

    // ✅ isso aqui é o que seu front precisa
    return NextResponse.json({ checkout_url });
  } catch (err: any) {
    return jsonError(500, "Erro inesperado ao criar checkout.", {
      message: err?.message || String(err),
    });
  }
}
