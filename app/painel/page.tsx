"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { getSession, logout } from "@/lib/auth";
import { setAvatar, getAvatar, clearAvatar } from "@/lib/avatar";

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
        const res = await fetch("/user/balance", { credentials: "include" });
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

      setAvatar(dataUrl);
      setAvatarState(dataUrl);
      alert("Avatar atualizado!");
    };
    reader.readAsDataURL(file);
  }

  function setAvatar(dataUrl: string) {
    setAvatarState(dataUrl);
    setAvatar(dataUrl);
  }

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

                  <Link href="/" className="btn-header btn-header--ghost">
                    Voltar
                  </Link>

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
        </div>
      </div>
    </>
  );
}
