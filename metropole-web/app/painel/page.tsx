"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSession, logout } from "@/lib/auth";
import { setAvatar, getAvatar, clearAvatar } from "@/lib/avatar";

type Session = {
  ok: true;
  user_id: number | string;
  username: string;
  vip?: string;
};

export default function PainelPage() {
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);

  const [avatar, setAvatarState] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s?.ok) {
      // força abrir login na home
      localStorage.setItem("open_login_modal", "1");
      window.location.href = "/?login=1";
      return;
    }

    setSessionState({
      ok: true,
      user_id: s.user_id,
      username: s.username,
      vip: s.vip,
    });

    setAvatarState(getAvatar());
    setReady(true);
  }, []);

  const userTag = useMemo(() => {
    if (!session) return "";
    return `#${session.user_id}`;
  }, [session]);

  async function onPickFile(file: File | null) {
    if (!file) return;

    // limites básicos
    if (!file.type.startsWith("image/")) return alert("Envie uma imagem.");
    if (file.size > 2 * 1024 * 1024) return alert("Imagem muito grande (max 2MB).");

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) return;

      setAvatar(dataUrl); // salva no localStorage + dispara evento
      setAvatarState(dataUrl);
      alert("Avatar atualizado!");
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    clearAvatar();
    setAvatarState(null);
  }

  if (!ready || !session) return null;

  return (
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

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn-header btn-header--primary"
                  onClick={() => inputRef.current?.click()}
                >
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
  );
}
