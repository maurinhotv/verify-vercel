export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-icons flex items-center gap-4">
          <a href="#" aria-label="Instagram">
            <img src="/icon-instagram.svg" alt="" className="h-5 w-5" />
          </a>
          <a href="#" aria-label="YouTube">
            <img src="/icon-youtube.svg" alt="" className="h-5 w-5" />
          </a>
          <a href="#" aria-label="X">
            <span className="text-white/80 font-black">X</span>
          </a>
          <a href="#" aria-label="Discord">
            <img src="/icon-discord.svg" alt="" className="h-5 w-5" />
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
