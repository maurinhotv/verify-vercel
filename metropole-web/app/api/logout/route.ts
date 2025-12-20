import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("session_token")?.value;

  if (token) {
    await supabaseAdmin.from("sessions").delete().eq("token", token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "session_token",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0),
  });

  return res;
}
