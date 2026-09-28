import { Fraunces, Inter, Manrope, Sora } from "next/font/google";

/**
 * Pares tipográficos dos 3 temas prontos (`Tenant.theme`, docs/design/direcoes.md).
 * Carregados uma única vez aqui (não em cada layout) e expostos como variáveis
 * CSS via `variable`. Qual variável cada tema realmente USA é decidido em
 * `globals.css` (`--panel-font-display`/`--panel-font-body` por `[data-theme]`) —
 * nenhum componente referencia estas variáveis diretamente.
 *
 * Todos os 3 root layouts (público, painel do tenant, admin da plataforma)
 * aplicam `fontVariables` no `<html>` para que a troca de tema não exija
 * recarregar fontes.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const fontVariables = [
  inter.variable,
  manrope.variable,
  fraunces.variable,
  sora.variable,
].join(" ");
