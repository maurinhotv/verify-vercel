"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`
        fixed top-0 left-0 w-full z-50 transition-all duration-300
        ${scrolled ? "bg-black/60 backdrop-blur-xl border-b border-white/10" : "bg-transparent"}
      `}
    >
      <div className="max-w-7xl mx-auto px-6 h-[76px] flex items-center justify-between">
        {/* LOGO */}
        <div className="flex items-center gap-2 font-bold text-white">
          <span className="text-[var(--green)]">▮▮</span>
          metrópole
        </div>

        {/* MENU */}
        <nav className="hidden md:flex gap-8 text-sm text-white/90">
          {["Nossas Cidades", "Notícias", "Diamantes", "Anticheat"].map(item => (
            <a
              key={item}
              href="#"
              className="relative hover:text-white transition underline-sweep"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* BOTÃO */}
        <Link
          href="/login"
          className="btn-green btn-shine px-6 py-2 text-sm"
        >
          ENTRAR
        </Link>
      </div>
    </header>
  );
}
