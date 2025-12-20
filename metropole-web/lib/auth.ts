export type SessionPayload = {
  ok: true;
  username: string;
  user_id: string | number;
  vip?: string;
};

const SESSION_KEY = "prizma_session_v1";
const USER_KEY = "prizma_user"; // usado no Header

export function setSession(payload: SessionPayload) {
  if (typeof window === "undefined") return;

  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ id: payload.user_id, username: payload.username })
  );

  window.dispatchEvent(new Event("prizma:session"));
}

export function getSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

/** Remove sessão (nome novo) */
export function clearSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);

  window.dispatchEvent(new Event("prizma:session"));
}

/** Remove sessão (nome antigo, compatibilidade) */
export function logout() {
  clearSession();
}
