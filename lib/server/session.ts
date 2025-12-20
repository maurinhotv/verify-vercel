import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export type SessionUser = {
  id: number;
  username: string;
};

const COOKIE_NAME = "session_token";

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const { data: sess } = await supabaseAdmin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();

  if (!sess?.user_id) return null;
  if (new Date(sess.expires_at).getTime() < Date.now()) return null;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, username")
    .eq("id", sess.user_id)
    .single();

  if (!user) return null;

  return {
    id: Number(user.id),
    username: String(user.username),
  };
}
