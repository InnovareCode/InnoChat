"use server";

import { z } from "zod";
import { runAction, type Result } from "@/lib/result";
import { DomainError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { hasPlatformAdmin, installPlatformAdmin } from "./install";

/**
 * Server Action pública de `/instalacao` (docs/contratos.md). Sem `requirePlatformAdmin` — não
 * há admin ainda quando isto roda; a segurança vem do código de instalação (hash + expiração +
 * uso único, `src/modules/platform/install.ts`) e do rate limit por IP abaixo, mesma técnica
 * de `src/modules/signup/actions.ts`.
 */

const INSTALL_LIMIT = 10;
const INSTALL_WINDOW_MS = 15 * 60 * 1000;

const installSchema = z.object({
  code: z.string().trim().min(10).max(200),
  // Coletado por simetria com o cadastro público (`ownerName` em src/modules/signup) — `User`
  // não tem campo de nome na v1 (mesma lacuna já existente lá); guardado só para confirmação
  // na tela, não persistido.
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
});

export async function hasPlatformAdminAction(): Promise<Result<{ installed: boolean }>> {
  return runAction(async () => ({ installed: await hasPlatformAdmin() }));
}

export async function installPlatformAdminAction(input: unknown): Promise<Result<{ userId: string }>> {
  return runAction(async () => {
    const ip = await clientIp();
    const rate = checkRateLimit(`install:${ip}`, INSTALL_LIMIT, INSTALL_WINDOW_MS);
    if (!rate.allowed) {
      throw new DomainError("RATE_LIMITED", "Muitas tentativas. Tente novamente em alguns minutos.", {
        retryAfterMs: rate.retryAfterMs,
      });
    }

    if (await hasPlatformAdmin()) {
      throw new DomainError("ALREADY_INSTALLED", "A instalação já foi concluída.");
    }

    const data = installSchema.parse(input);
    return installPlatformAdmin(data);
  });
}
