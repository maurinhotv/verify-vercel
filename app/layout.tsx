import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boreal Roleplay",
  description: "Site do servidor Boreal Roleplay",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
