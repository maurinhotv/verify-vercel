"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

  const readSectionFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setS(sp.get("s") || "");
  }, []);

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
      try {
        const rawUser = localStorage.getItem("prizma_user");
        setUser(rawUser ? JSON.parse(rawUser) : null);
      } catch {
        setUser(null);
      }

      try {
        setAvatarState(getAvatar());
      } catch {
        setAvatarState(null);
      }

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
    window.addEventListener("prizma:diamonds", readAll);

    return () => {
      window.removeEventListener("prizma:session", readAll);
      window.removeEventListener("prizma:avatar", readAll);
      window.removeEventListener("prizma:diamonds", readAll);
    };
  }, []);

  const goHome = () => {
    setS(""); // ✅ atualiza estado local
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/", { scroll: true });
  };

  const goSection = (section: "noticias" | "diamantes") => {
    setS(section); // ✅ atualiza estado local (evita depender de hook de search params)

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
          <span className="site-header__logoText">prizmaroleplay</span>
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

              <div className="account-pill__diamond">
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
