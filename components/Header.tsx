"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { getAvatar } from "@/lib/avatar";

type UserInfo = { id: number | string; username: string } | null;

type HeaderProps = {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onLogout: () => void;
};

export default function Header({ onOpenLogin, onOpenRegister, onLogout }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [user, setUser] = useState<UserInfo>(null);
  const [avatar, setAvatarState] = useState<string | null>(null);
  const [diamonds, setDiamonds] = useState<number>(0);

  // ✅ Substitui useSearchParams: lê ?s= diretamente da URL (client-only)
  const [s, setS] = useState<string>("");

  // ---- anti-loop / balance guards ----
  const lastUserRawRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const got401Ref = useRef(false);

  const readSectionFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setS(sp.get("s") || "");
  }, []);

  // ✅ Busca saldo real no backend (fonte da verdade) — com throttle e bloqueio de 401
  const refreshDiamonds = useCallback(
    async (opts?: { force?: boolean }) => {
      try {
        // se não estiver logado, zera e não chama backend
        if (!user) {
          setDiamonds(0);
          try {
            localStorage.setItem("prizma_diamonds_v1", "0");
          } catch {}
          return;
        }

        // se já tomou 401, não fica martelando (só volta quando sessão mudar)
        if (got401Ref.current && !opts?.force) return;

        // throttle (evita spam)
        const now = Date.now();
        const cooldownMs = 8000;
        if (!opts?.force && now - lastFetchAtRef.current < cooldownMs) return;

        // evita fetch concorrente
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        lastFetchAtRef.current = now;

        const res = await fetch("/user/balance", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (res.status === 401) {
          // sessão inválida/expirada: para de tentar até o usuário logar de novo
          got401Ref.current = true;
          setDiamonds(0);
          try {
            localStorage.setItem("prizma_diamonds_v1", "0");
          } catch {}
          return;
        }

        if (!res.ok) return;

        const data: any = await res.json();

        // aceita vários formatos
        const valRaw = data?.diamonds ?? data?.balance ?? data?.amount ?? 0;
        const val = Number(valRaw) || 0;

        setDiamonds(val);

        // cache local (só pra UI rápida)
        try {
          localStorage.setItem("prizma_diamonds_v1", String(val));
        } catch {}
      } catch {
        // ignora
      } finally {
        inFlightRef.current = false;
      }
    },
    [user]
  );

  useEffect(() => {
    // atualiza no mount e quando trocar de rota
    readSectionFromUrl();

    // atualiza quando usuário usar voltar/avançar
    const onPop = () => readSectionFromUrl();
    window.addEventListener("popstate", onPop);

    return () => window.removeEventListener("popstate", onPop);
  }, [pathname, readSectionFromUrl]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = ["noticias", "diamantes"];
    const onScroll = () => {
      let current = "";
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= 140 && r.bottom >= 140) {
          current = id;
          break;
        }
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // scroll automático quando vier /?s=...
  useEffect(() => {
    const target = s;
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [s]);

  useEffect(() => {
    const readAll = () => {
      // ---- user: só atualiza se o JSON mudar (evita loop) ----
      try {
        const rawUser = localStorage.getItem("prizma_user");
        if (rawUser !== lastUserRawRef.current) {
          lastUserRawRef.current = rawUser;
          setUser(rawUser ? JSON.parse(rawUser) : null);

          // se a sessão mudou, libera tentar o /user/balance de novo
          got401Ref.current = false;
        }
      } catch {
        lastUserRawRef.current = null;
        setUser(null);
        got401Ref.current = false;
      }

      // avatar
      try {
        setAvatarState(getAvatar());
      } catch {
        setAvatarState(null);
      }

      // mostra algo rápido enquanto busca o valor real no backend
      try {
        const rawD = localStorage.getItem("prizma_diamonds_v1");
        setDiamonds(rawD ? Number(rawD) || 0 : 0);
      } catch {
        setDiamonds(0);
      }
    };

    readAll();
    window.addEventListener("prizma:session", readAll);
    window.addEventListener("prizma:avatar", readAll);

    // quando alguém disparar evento de diamante, puxa do backend também
    const onDiamonds = () => {
      readAll();
      // sincroniza com o servidor (força, mas respeita inFlight)
      setTimeout(() => refreshDiamonds({ force: true }), 50);
    };
    window.addEventListener("prizma:diamonds", onDiamonds);

    return () => {
      window.removeEventListener("prizma:session", readAll);
      window.removeEventListener("prizma:avatar", readAll);
      window.removeEventListener("prizma:diamonds", onDiamonds);
    };
  }, [refreshDiamonds]);

  // quando user muda (login/logout), sincroniza o saldo real (com throttle)
  useEffect(() => {
    refreshDiamonds({ force: true });
  }, [refreshDiamonds]);

  const goHome = () => {
    setS("");
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/", { scroll: true });
  };

  const goSection = (section: "noticias" | "diamantes") => {
    setS(section);

    if (pathname === "/") {
      const el = document.getElementById(section);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push(`/?s=${section}`, { scroll: false });
      }
      return;
    }

    router.push(`/?s=${section}`, { scroll: false });
  };

  const isActive = useMemo(() => {
    const key = activeSection || s || "";
    return {
      home: key === "",
      noticias: key === "noticias",
      diamantes: key === "diamantes",
    };
  }, [activeSection, s]);

  const openPanel = () => router.push("/painel");

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="site-header__container">
        {/* LEFT */}
        <button className="site-header__logo" onClick={goHome} aria-label="Home">
          <img src="logo.svg" alt="" />
        </button>

        {/* CENTER */}
        <nav className="site-header__nav" aria-label="Menu">
          <button className={`site-header__navLink ${isActive.home ? "active" : ""}`} onClick={goHome}>
            Home
          </button>

          <button
            className={`site-header__navLink ${isActive.noticias ? "active" : ""}`}
            onClick={() => goSection("noticias")}
          >
            Notícias
          </button>

          <button
            className={`site-header__navLink ${isActive.diamantes ? "active" : ""}`}
            onClick={() => goSection("diamantes")}
          >
            Diamantes
          </button>
        </nav>

        {/* RIGHT */}
        <div className="site-header__actions">
          {!user ? (
            <>
              <button className="btn-header btn-header--primary" onClick={onOpenLogin}>
                Entrar
              </button>
            </>
          ) : (
            <div className="account-pill">
              <button className="account-pill__panel" onClick={openPanel}>
                ACESSAR PAINEL <span className="arrow">›</span>
              </button>

              <div
                className="account-pill__diamond"
                title="Se não atualizar, recarregue o painel ou aguarde alguns segundos."
              >
                <img src="/diamond.svg" alt="Diamante" />
                <span className="account-pill__diamondText">{diamonds}</span>
              </div>

              <div className="account-pill__avatar">
                {avatar ? <img src={avatar} alt="Avatar" /> : <div className="account-pill__avatarFallback" />}
              </div>

              <div className="account-pill__meta">
                <div className="account-pill__name">{user.username}</div>
                <div className="account-pill__id">#{user.id}</div>
              </div>

              <button
                className="account-pill__logout"
                title="Sair"
                onClick={() => {
                  clearSession();
                  setDiamonds(0);
                  try {
                    localStorage.setItem("prizma_diamonds_v1", "0");
                  } catch {}
                  got401Ref.current = false;
                  lastFetchAtRef.current = 0;
                  onLogout();
                }}
              >
                <span>▾</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
