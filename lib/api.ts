export async function postJSON<T>(
  url: string,
  body: any
): Promise<{ ok: boolean; status: number; data?: T; errorText?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => "");
    const data = text ? (JSON.parse(text) as T) : undefined;

    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, errorText: e?.message ?? "network_error" };
  }
}
