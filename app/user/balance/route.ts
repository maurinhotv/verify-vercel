import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("users")
    .select("diamonds")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ diamonds: Number(data?.diamonds ?? 0) });
}
