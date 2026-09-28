"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import {
  getMaskedPlatformSettings,
  regenerateInternalApiSecret,
  updatePlatformSettings,
  type PlatformSettingsView,
} from "./service";

/**
 * Server Actions do admin da plataforma (docs/contratos.md). Guardadas por
 * `requirePlatformAdmin()` — nunca confiam em nada vindo do client sobre a sessão.
 */

export async function getPlatformSettingsAction(): Promise<Result<PlatformSettingsView>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    return getMaskedPlatformSettings();
  });
}

const updatePlatformSettingsSchema = z.object({
  evolutionApiUrl: z.union([z.literal(""), z.string().url()]).optional(),
  evolutionApiKey: z.string().max(500).optional(),
  n8nWebhookBaseUrl: z.union([z.literal(""), z.string().url()]).optional(),
  mercadoPagoAccessToken: z.string().max(500).optional(),
  mercadoPagoWebhookSecret: z.string().max(500).optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPassword: z.string().max(500).optional(),
  smtpFrom: z.union([z.literal(""), z.string().email()]).optional(),
  termsVersion: z.string().max(50).optional(),
});

export async function updatePlatformSettingsAction(input: unknown): Promise<Result<PlatformSettingsView>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = updatePlatformSettingsSchema.parse(input);
    return updatePlatformSettings(data, admin.id);
  });
}

/**
 * Gera e devolve o segredo da API interna EM TEXTO PURO — só nesta chamada. A tela precisa
 * mostrar isso ao dono uma única vez e nunca mais poder buscá-lo de volta.
 */
export async function regenerateInternalApiSecretAction(): Promise<Result<{ secret: string }>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    return regenerateInternalApiSecret(admin.id);
  });
}
