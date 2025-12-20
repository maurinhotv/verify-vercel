const $code = document.getElementById("code");
const $btn = document.getElementById("btn");
const $msg = document.getElementById("msg");

function setMsg(text, ok) {
  $msg.textContent = text;
  $msg.className = "mt-4 text-sm " + (ok ? "text-emerald-300" : "text-zinc-300");
}

$code.addEventListener("input", () => {
  $code.value = $code.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

$btn.addEventListener("click", async () => {
  const code = $code.value.trim();
  if (!code) return setMsg("Digite o código.", false);

  $btn.disabled = true;
  $btn.textContent = "Verificando...";

  try {
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const data = await r.json().catch(() => ({}));

    if (r.ok && data.verified) setMsg("Verificado com sucesso! Pode voltar pro jogo.", true);
    else setMsg("Código inválido/expirado. Volte no jogo e pegue um novo.", false);
  } catch {
    setMsg("Erro de rede. Tente novamente.", false);
  } finally {
    $btn.disabled = false;
    $btn.textContent = "Verificar";
  }
});
