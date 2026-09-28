"use server";

import { z } from "zod";
import { requireTenantMember, requireVerifiedEmail } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { assertTenantCanWrite } from "@/modules/billing/service";
import {
  createWhatsappInstance,
  disconnectWhatsapp,
  getQrCode,
  listWhatsappInstances,
  refreshConnectionStatus,
  removeWhatsappInstance,
  setSandbox,
  type ConnectionStatusView,
  type QrCodeView,
  type WhatsappInstanceView,
} from "./service";

// Reexportados para a Lyra consumir sem importar direto de `./service` (camada de domínio) nos
// Client Components — mesma convenção de `PlanListItem` em `src/modules/billing/actions.ts`.
export type { ConnectionStatusView, QrCodeView, WhatsappInstanceView };

/**
 * Server Actions da tela "WhatsApp" (docs/arquitetura.md §4, §9; docs/contratos.md "WhatsApp
 * (Fase 3)"). Toda ação de MUTAÇÃO (`create`/`disconnect`/`remove`/`setSandbox`) é restrita a
 * `OWNER` — é uma decisão de infraestrutura da empresa (custa número/instância compartilhada com
 * o InnoAtendente), mesmo nível de `updateTenantThemeAction`. Leitura (`list`/`getQrCode`/
 * `refresh`) fica aberta a qualquer membro — útil para um `STAFF` acompanhar a conexão feita
 * pelo dono.
 */

const labelSchema = z.object({ label: z.string().trim().min(1).max(60) });
const sandboxSchema = z.object({ sandbox: z.boolean() });

export async function listWhatsappInstancesAction(tenantSlug: string): Promise<Result<WhatsappInstanceView[]>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return listWhatsappInstances(tenant.id);
  });
}

/**
 * Exige e-mail verificado (`requireVerifiedEmail`, docs/arquitetura.md §7.3 regra 2) ANTES de
 * `requireTenantMember(..., ["OWNER"])` — mission: "sem e-mail verificado, não é possível
 * conectar WhatsApp". A ordem importa: um usuário sem e-mail verificado recebe sempre o mesmo
 * erro (`EMAIL_NOT_VERIFIED`), independente de ser ou não `OWNER` do tenant — não vaza se ele
 * tem ou não permissão ali.
 */
export async function createWhatsappInstanceAction(tenantSlug: string, input: unknown): Promise<Result<WhatsappInstanceView>> {
  return runAction(async () => {
    await requireVerifiedEmail();
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    const { label } = labelSchema.parse(input);
    return createWhatsappInstance({ tenantId: tenant.id, tenantSlug: tenant.slug, label });
  });
}

export async function getQrCodeAction(tenantSlug: string, instanceId: string): Promise<Result<QrCodeView>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return getQrCode(tenant.id, instanceId);
  });
}

export async function refreshConnectionStatusAction(tenantSlug: string, instanceId: string): Promise<Result<ConnectionStatusView>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return refreshConnectionStatus(tenant.id, instanceId);
  });
}

export async function disconnectWhatsappAction(tenantSlug: string, instanceId: string): Promise<Result<WhatsappInstanceView>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    return disconnectWhatsapp(tenant.id, instanceId);
  });
}

export async function removeWhatsappInstanceAction(tenantSlug: string, instanceId: string): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    return removeWhatsappInstance(tenant.id, instanceId);
  });
}

export async function setSandboxAction(tenantSlug: string, instanceId: string, input: unknown): Promise<Result<WhatsappInstanceView>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    const { sandbox } = sandboxSchema.parse(input);
    return setSandbox(tenant.id, instanceId, sandbox);
  });
}
