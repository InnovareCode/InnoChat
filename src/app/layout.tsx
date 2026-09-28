import type { Metadata } from "next";
import "./globals.css";

// Layout mínimo e neutro — só a casca para compilar. A direção visual (Lyra)
// ainda não está definida; não há tema, fonte nem componente de produto aqui.
export const metadata: Metadata = {
  title: "InnoChat",
  description: "Painel InnoChat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
