"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import Footer from "@/components/Footer";
import { getSession, logout } from "@/lib/auth";
import { setAvatar as saveAvatar, getAvatar, clearAvatar } from "@/lib/avatar";

type Session = {
  ok: true;
  user_id: number | string;
  username: string;
  vip?: string;
};

function DiamondIcon() {
  return (
    <span className="inline-flex items-center justify-center">
      <img src="/diamond.svg" alt="Diamante" className="w-4 h-4" draggable={false} />
    </span>
  );
}

export default function PainelPage() {
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);

  const [avatar, setAvatarState] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [diamonds, setDiamonds] = useState<number>(0);
  const [loadingPackage, setLoadingPackage] = useState<number | null>(null);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastText, setToastText] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");

  const onToast = (title: string, text: string, type: "ok" | "err" = "ok") => {
    setToastTitle(title);
    setToastText(text);
    setToastType(type);
    setToastOpen(true);
  };

  async function buyPackage(packageId: number) {
    try {
      setLoadingPackage(packageId);

      const res = await fetch("/api/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packageId }),
      });

      if (res.status === 401) {
        localStorage.setItem("open_login_modal", "1");
        onToast("Faça login", "Você precisa estar logado para comprar diamantes.", "err");
        window.location.href = "/?login=1";
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onToast("Erro", data?.error ?? "Falha ao criar pedido", "err");
        return;
      }

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      onToast("Erro", "Resposta inválida do servidor (sem checkout_url).", "err");
    } catch (e) {
      onToast("Erro", "Falha inesperada ao iniciar o checkout", "err");
    } finally {
      setLoadingPackage(null);
    }
  }

  useEffect(() => {
    const s: any = getSession();
    if (!s?.ok) {
      localStorage.setItem("open_login_modal", "1");
      window.location.href = "/?login=1";
      return;
    }

    // ✅ Corrige: aceita id OU user_id (sem mudar API)
    const resolvedId = s.user_id ?? s.id ?? s.userId ?? null;

    setSessionState({
      ok: true,
      user_id: resolvedId,
      username: s.username,
      vip: s.vip,
    });

    setAvatarState(getAvatar());

    try {
      const cached = Number(localStorage.getItem("prizma_diamonds_v1") || "0");
      if (!Number.isNaN(cached)) setDiamonds(cached);
    } catch {}

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !session) return;

    let cancelled = false;

    async function loadBalance() {
      try {
        const res = await fetch("/api/user/balance", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const value = Number(data?.diamonds ?? data?.balance ?? 0);
        if (cancelled) return;

        if (!Number.isNaN(value)) {
          setDiamonds(value);
          try {
            localStorage.setItem("prizma_diamonds_v1", String(value));
            window.dispatchEvent(new CustomEvent("prizma:diamonds", { detail: { diamonds: value } }));
          } catch {}
        }
      } catch {}
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  useEffect(() => {
    const onDiamonds = (ev: Event) => {
      const e = ev as CustomEvent;
      const value = Number(e?.detail?.diamonds);
      if (!Number.isNaN(value)) setDiamonds(value);
    };

    window.addEventListener("prizma:diamonds", onDiamonds as EventListener);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "prizma_diamonds_v1") {
        const v = Number(e.newValue || "0");
        if (!Number.isNaN(v)) setDiamonds(v);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("prizma:diamonds", onDiamonds as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const userTag = useMemo(() => {
    if (!session) return "";
    const uid: any = (session as any).user_id ?? (session as any).id ?? (session as any).userId;
    return uid ? `#${uid}` : "";
  }, [session]);

  async function onPickFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) return alert("Envie uma imagem.");
    if (file.size > 2 * 1024 * 1024) return alert("Imagem muito grande (max 2MB).");

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) return;

      saveAvatar(dataUrl);
      setAvatarState(dataUrl);
      alert("Avatar atualizado!");
    };
    reader.readAsDataURL(file);
  }

  // usa `saveAvatar` (importado) para persistir, e `setAvatarState` para estado local

  function removeAvatar() {
    clearAvatar();
    setAvatarState(null);
  }

  if (!ready || !session) return null;

  return (
    <>
      <Header
        onOpenLogin={() => {
          localStorage.setItem("open_login_modal", "1");
          window.location.href = "/?login=1";
        }}
        onOpenRegister={() => {
          localStorage.setItem("open_register_modal", "1");
          window.location.href = "/?register=1";
        }}
        onLogout={() => {
          logout();
          window.location.href = "/";
        }}
      />

      <div className="min-h-screen pt-[110px] px-6">
        <div className="mx-auto max-w-[1000px]">
          <div className="card p-6">
            <div className="flex items-center gap-5">
              <div className="w-[140px] h-[140px] rounded-2xl overflow-hidden border border-white/10 bg-black/30 grid place-items-center">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-white/60 font-black">Sem avatar</div>
                )}
              </div>

              <div className="flex-1">
                <div className="text-white/60 font-black">Bem Vindo(a),</div>
                <div className="text-3xl font-black text-white">{session.username}</div>
                <div className="text-white/60 font-extrabold mt-1">{userTag}</div>

                <div className="mt-3 flex items-center gap-2 text-white/90 font-extrabold">
                  <span className="text-white/70 font-black">Você possui</span>
                  <DiamondIcon />
                  <span className="text-white font-black">{diamonds}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-header btn-header--primary" onClick={() => inputRef.current?.click()}>
                    Trocar imagem
                  </button>

                  <button className="btn-header btn-header--ghost" onClick={removeAvatar}>
                    Remover
                  </button>

                  <button
                    className="btn-header btn-header--danger"
                    onClick={() => {
                      logout();
                      window.location.href = "/";
                    }}
                  >
                    Sair
                  </button>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* DIAMANTES */}
          <section id="diamantes" className="section ">
            <div className="section-inner">
              <h2 className="section-title" style={{ color: "var(--green)" }}>
                PACOTES DE DIAMANTES
              </h2>
              <p className="section-subtitle">Muito mais vantagens por um pequeno valor</p>

              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-center">
                <div className="card p-4">
                  <img src="/character-diamonds.svg" alt="" className="w-full h-[320px] object-contain" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* PACOTE 1 */}
                  <div className="card p-6">
                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon /> <span className="text-lg">150</span>
                    </div>
                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 9,99</div>
                    <button
                      disabled={loadingPackage === 1}
                      onClick={() => buyPackage(1)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 1 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                  {/* PACOTE 2 */}
                  <div className="card p-6">
                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon /> <span className="text-lg">260</span>
                    </div>
                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 19,99</div>
                    <button
                      disabled={loadingPackage === 2}
                      onClick={() => buyPackage(2)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 2 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                  {/* PACOTE 3 */}
                  <div className="card p-6 ring-2 ring-sky-200/40">
                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon /> <span className="text-lg">450</span>
                    </div>
                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 29,99</div>
                    <button
                      disabled={loadingPackage === 3}
                      onClick={() => buyPackage(3)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 3 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                  {/* PACOTE 4 — 15% BÔNUS */}
                  <div className="card p-6 relative overflow-hidden">
                    <div className="absolute top-3 left-3 bg-sky-200 text-black text-xs font-black px-3 py-1 rounded-full">
                      15% BÔNUS
                    </div>

                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon />
                      <span className="text-sm line-through opacity-50">700</span>
                      <span className="text-lg">805</span>
                    </div>

                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 49,99</div>
                    <button
                      disabled={loadingPackage === 4}
                      onClick={() => buyPackage(4)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 4 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                  {/* PACOTE 5 — 25% BÔNUS */}
                  <div className="card p-6 relative overflow-hidden">
                    <div className="absolute top-3 left-3 bg-sky-200 text-black text-xs font-black px-3 py-1 rounded-full">
                      25% BÔNUS
                    </div>

                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon />
                      <span className="text-sm line-through opacity-50">1.100</span>
                      <span className="text-lg">1.375</span>
                    </div>

                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 74,99</div>
                    <button
                      disabled={loadingPackage === 5}
                      onClick={() => buyPackage(5)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 5 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                  {/* PACOTE 6 — 40% BÔNUS */}
                  <div className="card p-6 relative overflow-hidden ring-2 ring-sky-200">
                    <div className="absolute top-3 left-3 bg-sky-200 text-black text-xs font-black px-3 py-1 rounded-full">
                      40% BÔNUS
                    </div>

                    <div className="flex items-center gap-2 font-extrabold text-white/90">
                      <DiamondIcon />
                      <span className="text-sm line-through opacity-50">1.600</span>
                      <span className="text-lg">2.240</span>
                    </div>

                    <div className="mt-3 text-sky-200 font-black text-lg">R$ 99,99</div>
                    <button
                      disabled={loadingPackage === 6}
                      onClick={() => buyPackage(6)}
                      className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                    >
                      {loadingPackage === 6 ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>

                </div>

              </div>
            </div>
          </section>

        </div>
      </div>
    
      <Footer />
      <Toast open={toastOpen} title={toastTitle} text={toastText} type={toastType} onClose={() => setToastOpen(false)} />
    </>
    
  );
}

