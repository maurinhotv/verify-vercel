"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { postJSON } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function AuthModals({
  openLogin,
  openRegister,
  setOpenLogin,
  setOpenRegister,
  onToast,
  onLogged,
}: {
  openLogin: boolean;
  openRegister: boolean;
  setOpenLogin: (v: boolean) => void;
  setOpenRegister: (v: boolean) => void;
  onToast: (title: string, text: string, type?: "ok" | "err") => void;
  onLogged: () => void;
}) {
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPass, setRegPass] = useState("");

  const [busyLogin, setBusyLogin] = useState(false);
  const [busyReg, setBusyReg] = useState(false);

  const isOpen = openLogin || openRegister;

  function closeAll() {
    setOpenLogin(false);
    setOpenRegister(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function doLogin() {
    const u = loginUser.trim();
    const p = loginPass;

    if (!u || !p) return onToast("Login", "Preencha usuário e senha.", "err");

    setBusyLogin(true);
    const res = await postJSON<any>("/api/login", { username: u, password: p });
    setBusyLogin(false);

    if (res.ok && res.data?.ok) {
      setSession({
        ok: true,
        username: res.data.username ?? u,
        user_id: res.data.user_id,
        vip: res.data.vip ?? "none",
      });

      onToast("Bem-vindo", "Login efetuado com sucesso.", "ok");
      closeAll();
      onLogged();
    } else {
      onToast("Login", "Usuário ou senha inválidos.", "err");
    }
  }

  async function doRegister() {
    const u = regUser.trim();
    const p = regPass;

    if (u.length < 3) return onToast("Cadastro", "Usuário muito curto (mín. 3).", "err");
    if (p.length < 6) return onToast("Cadastro", "Senha muito curta (mín. 6).", "err");

    setBusyReg(true);
    const res = await postJSON<any>("/api/registerUser", { username: u, password: p });
    setBusyReg(false);

    if (res.ok && res.data?.ok) {
      onToast("Conta", "Conta criada! Agora faça login.", "ok");
      setOpenRegister(false);
      setOpenLogin(true);
      setLoginUser(u);
      setLoginPass("");
    } else {
      onToast("Erro", res.data?.msg ?? "Não foi possível criar conta.", "err");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-md p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAll();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[rgba(10,12,10,92)] shadow-2xl backdrop-blur-md overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="font-black text-lg">{openLogin ? "Entrar" : "Criar Conta"}</div>
              <button
                type="button"
                onClick={closeAll}
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {openLogin ? (
                <>
                  <Field label="Usuário">
                    <input
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin()}
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 outline-none
                                 focus:ring-4 focus:ring-[rgba(84,209,99,18)] focus:border-[rgba(84,209,99,35)]"
                      placeholder="Seu usuário"
                      autoFocus
                    />
                  </Field>

                  <Field label="Senha">
                    <input
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin()}
                      type="password"
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 outline-none
                                 focus:ring-4 focus:ring-[rgba(84,209,99,18)] focus:border-[rgba(84,209,99,35)]"
                      placeholder="Sua senha"
                    />
                  </Field>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenLogin(false);
                        setOpenRegister(true);
                      }}
                      className="btn-ghost btn-shine flex-1 px-4 py-3 font-black uppercase text-xs"
                    >
                      Criar conta
                    </button>

                    <button
                      type="button"
                      onClick={doLogin}
                      disabled={busyLogin}
                      className="btn-green btn-shine flex-1 px-4 py-3 font-black uppercase text-xs disabled:opacity-60"
                    >
                      {busyLogin ? "Entrando..." : "Entrar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Usuário">
                    <input
                      value={regUser}
                      onChange={(e) => setRegUser(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doRegister()}
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 outline-none
                                 focus:ring-4 focus:ring-[rgba(84,209,99,18)] focus:border-[rgba(84,209,99,35)]"
                      placeholder="Escolha um usuário"
                      autoFocus
                    />
                    <div className="mt-2 text-xs text-white/60 font-semibold">Mínimo 3 caracteres.</div>
                  </Field>

                  <Field label="Senha">
                    <input
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doRegister()}
                      type="password"
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 outline-none
                                 focus:ring-4 focus:ring-[rgba(255,105,180,18)] focus:border-[rgba(255,105,180,35)]"
                      placeholder="Crie uma senha"
                    />
                    <div className="mt-2 text-xs text-white/60 font-semibold">Mínimo 6 caracteres.</div>
                  </Field>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenRegister(false);
                        setOpenLogin(true);
                      }}
                      className="btn-ghost btn-shine flex-1 px-4 py-3 font-black uppercase text-xs"
                    >
                      Já tenho conta
                    </button>

                    <button
                      type="button"
                      onClick={doRegister}
                      disabled={busyReg}
                      className="btn-green btn-shine flex-1 px-4 py-3 font-black uppercase text-xs disabled:opacity-60"
                    >
                      {busyReg ? "Criando..." : "Criar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-wide text-white/80 mb-2">{label}</div>
      {children}
    </div>
  );
}
