export const AVATAR_KEY = "prizma_avatar_v1";

export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export function setAvatar(dataUrl: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AVATAR_KEY, dataUrl);
  // força Header / qualquer lugar a atualizar
  window.dispatchEvent(new Event("prizma:avatar"));
}

export function clearAvatar() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AVATAR_KEY);
  window.dispatchEvent(new Event("prizma:avatar"));
}
