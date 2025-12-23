"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthModals from "@/components/AuthModals";
import Toast from "@/components/Toast";
import QueryHandler from "./_components/QueryHandler";

function DiamondIcon() {
  return (
    <span className="diamond-icon">
      <img
        src="/diamond.svg"
        alt="Diamante"
        className="w-4 h-4"
        draggable={false}
      />
    </span>
  );
}

export default function HomePage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastText, setToastText] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");

  const [loadingPackage, setLoadingPackage] = useState<number | null>(null);

  const onToast = (title: string, text: string, type: "ok" | "err" = "ok") => {
    setToastTitle(title);
    setToastText(text);
    setToastType(type);
    setToastOpen(true);
    window.setTimeout(() => setToastOpen(false), 3200);
  };

  async function buyPackage(packageId: number) {
    try {
      setLoadingPackage(packageId);

      const res = await fetch("/api/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ manda o cookie session_token
        body: JSON.stringify({ packageId }),
      });

      if (res.status === 401) {
        setShowLoginModal(true);
        onToast("Faça login", "Você precisa estar logado para comprar diamantes.", "err");
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onToast("Erro", data?.error ?? "Falha ao criar pedido", "err");
        return;
      }

      // ✅ CHECKOUT: redireciona para Mercado Pago
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

  // abre login automaticamente (quando vem do /painel)
  useEffect(() => {
    try {
      const v = localStorage.getItem("open_login_modal");
      if (v === "1") {
        localStorage.removeItem("open_login_modal");
        setShowLoginModal(true);
      }
    } catch {}
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* ✅ FIX BUILD: qualquer uso de searchParams fica dentro do Suspense */}
      <Suspense fallback={null}>
        <QueryHandler onOpenLogin={() => setShowLoginModal(true)} />
      </Suspense>

      <Header
        onOpenLogin={() => setShowLoginModal(true)}
        onOpenRegister={() => setShowRegisterModal(true)}
        onLogout={() => {
          setShowLoginModal(false);
          setShowRegisterModal(false);
        }}
      />

      <Toast
        open={toastOpen}
        title={toastTitle}
        text={toastText}
        type={toastType}
        onClose={() => setToastOpen(false)}
      />

      <AuthModals
        openLogin={showLoginModal}
        openRegister={showRegisterModal}
        setOpenLogin={setShowLoginModal}
        setOpenRegister={setShowRegisterModal}
        onToast={onToast}
        onLogged={() => {}}
      />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-vignette" />

        <img src="/character-hero.svg" alt="" className="hero-character hidden md:block" />

        <div className="hero-content">
          <img src="/prizmologocentro.svg" alt="Prizma" className="hero-logo" />
          <div className="hero-subtitle">Sua nova história começa agora.</div>

          <div className="hero-actions hero-actions--single">
            <a className="btn-primary" href="mtasa://123.123.123.123:22003">
              <img src="/joystick.svg" alt="" className="h-5 w-5" />
              JOGAR AGORA <span className="opacity-80">›</span>
            </a>
          </div>

          <div className="hero-social hero-social--seq flex items-center gap-4">
            <a
              href="https://www.instagram.com/prizma.ltda"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="group"
            >
              <div
                className="h-5 w-5 bg-white transition-colors duration-300 group-hover:bg-green-500"
                style={{
                  maskImage: 'url("/icon-instagram.svg")',
                  WebkitMaskImage: 'url("/icon-instagram.svg")',
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            </a>

            <a
              href="https://www.youtube.com/@prizma.ltda"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="group"
            >
              <div
                className="h-5 w-5 bg-white transition-colors duration-300 group-hover:bg-green-500"
                style={{
                  maskImage: 'url("/icon-youtube.svg")',
                  WebkitMaskImage: 'url("/icon-youtube.svg")',
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            </a>

            <a
              href="https://discord.gg/d5KxDcQVwW"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="group"
            >
              <div
                className="h-5 w-5 bg-white transition-colors duration-300 group-hover:bg-green-500"
                style={{
                  maskImage: 'url("/icon-discord.svg")',
                  WebkitMaskImage: 'url("/icon-discord.svg")',
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            </a>
          </div>
        </div>
      </section>

      {/* NOTÍCIAS */}
      <section id="noticias" className="section section-news">
        <div className="section-inner relative">
          <h2 className="section-title">NOTÍCIAS & ATUALIZAÇÕES</h2>
          <p className="section-subtitle">Confira o que está acontecendo no servidor.</p>

          <div className="relative group">
            <button
              onClick={() =>
                document.getElementById("news-slider")!.scrollBy({ left: -300, behavior: "smooth" })
              }
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-green-600 hover:bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              ❮
            </button>

            <div
              id="news-slider"
              className="flex overflow-x-auto gap-6 scroll-smooth snap-x snap-mandatory scrollbar-hide pb-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {[
                { img: "/pathnotes1.svg", date: "17.12.25" },
                { img: "/pathnotes2.svg", date: "10.12.25" },
                { img: "/pathnotes3.svg", date: "26.11.25" },
                { img: "/pathnotes4.svg", date: "20.11.25" },
              ].map((p, idx) => (
                <div key={idx} className="cardpath p-5 min-w-[300px] md:min-w-[calc(33.333%-16px)] snap-start">
                  <div className="flex items-center justify-between mb-4">
                    <span className="pill text-xs font-extrabold text-white/85">{p.date}</span>
                    <span className="text-white/55 text-xs font-bold">PATCH NOTES</span>
                  </div>
                  <img src={p.img} alt="" className="w-full h-[160px] object-contain opacity-95" />
                  <div className="mt-4 text-[13px] text-white/80 font-extrabold">
                    Notas de Atualização — 2025
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                document.getElementById("news-slider")!.scrollBy({ left: 300, behavior: "smooth" })
              }
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-green-600 hover:bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              ❯
            </button>
          </div>
        </div>
      </section>

      {/* DIAMANTES */}
      <section id="diamantes" className="section section-diamonds ">
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
              <div className="card p-6">
                <div className="flex items-center gap-2 font-extrabold text-white/90">
                  <DiamondIcon /> <span className="text-lg">290</span>
                </div>
                <div className="mt-3 text-sky-200 font-black text-lg">R$ 69</div>
                <button
                  disabled={loadingPackage === 1}
                  onClick={() => buyPackage(1)}
                  className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                >
                  {loadingPackage === 1 ? "PROCESSANDO..." : "COMPRAR"}
                </button>
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-2 font-extrabold text-white/90">
                  <DiamondIcon /> <span className="text-lg">575</span>
                </div>
                <div className="mt-3 text-sky-200 font-black text-lg">R$ 129</div>
                <button
                  disabled={loadingPackage === 2}
                  onClick={() => buyPackage(2)}
                  className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                >
                  {loadingPackage === 2 ? "PROCESSANDO..." : "COMPRAR"}
                </button>
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-2 font-extrabold text-white/90">
                  <DiamondIcon /> <span className="text-lg">1.000</span>
                </div>
                <div className="mt-3 text-sky-200 font-black text-lg">R$ 255</div>
                <button
                  disabled={loadingPackage === 3}
                  onClick={() => buyPackage(3)}
                  className="mt-5 w-full rounded-xl bg-sky-200 text-black font-black py-3 disabled:opacity-60"
                >
                  {loadingPackage === 3 ? "PROCESSANDO..." : "COMPRAR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
