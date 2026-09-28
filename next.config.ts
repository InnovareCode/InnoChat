import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exigido pelo Dockerfile (build standalone) — gera .next/standalone com o
  // server mínimo para rodar sem o node_modules completo na imagem final.
  output: "standalone",
};

export default nextConfig;
