/**
 * Setup global dos testes de integração (`vitest.integration.config.ts`). Roda antes de cada
 * arquivo de teste (fora do escopo de uma requisição HTTP — sem `headers()`), então
 * `getPublicBaseUrl()` (`src/lib/public-url.ts`) cairia sempre no fallback de
 * `PlatformSettings.publicBaseUrl`. Simula "o admin já salvou Configurações uma vez" — nunca
 * sobrescreve se algum teste específico (ex.: `platform-install`) já tiver deixado outro valor.
 */
import { getPrisma } from "@/lib/db/prisma";

const prisma = getPrisma();
const current = await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { publicBaseUrl: true } });
if (!current?.publicBaseUrl) {
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, publicBaseUrl: "http://localhost:3000" },
    update: { publicBaseUrl: "http://localhost:3000" },
  });
}
