export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-icons flex items-center gap-4">
          <a href="https://instagram.com/borealroleplay" aria-label="Instagram">
            <img src="/icon-instagram.svg" alt="Instagram" className="h-5 w-5" />
          </a>
          <a href="https://youtube.com/@borealroleplay" aria-label="YouTube">
            <img src="/icon-youtube.svg" alt="Youtube" className="h-5 w-5" />
          </a>
          <a href="https://prizmaltda.com.br" aria-label="P">
            <span className="text-white/80 font-black">P</span>
          </a>
          <a href="https://discord.gg/rrkKduPDtp" aria-label="Discord">
            <img src="/icon-discord.svg" alt="Discord" className="h-5 w-5" />
          </a>
        </div>

        <div className="footer-text text-center flex-1">
          Todos os direitos reservados © PRIZMA LTDA 2025
        </div>

        <div className="flex items-center justify-end">
          <img src="/logo.svg" alt="Logo" className="h-7 w-auto opacity-95" />
        </div>
      </div>
    </footer>
  );
}
