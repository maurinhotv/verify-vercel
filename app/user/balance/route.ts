import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não definido");
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY não definido");

  return createClient(url, service, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  try {
    // 👇 NA SUA VERSÃO DO NEXT, cookies() é async
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Não autenticado" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const sb = supabaseAdmin();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("user_id")
      .eq("token", token)
      .single();

    if (sErr || !session?.user_id) {
      return NextResponse.json(
        { error: "Sessão inválida" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const { data: user, error: uErr } = await sb
      .from("users")
      .select("id, username, diamonds")
      .eq("id", session.user_id)
      .single();

    if (uErr || !user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      { diamonds: user.diamonds ?? 0 },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e: any) {
    const isProd = process.env.NODE_ENV === "production";

    return NextResponse.json(
      isProd
        ? { error: "Erro interno" }
        : { error: "Erro interno", details: String(e?.message ?? e) },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
