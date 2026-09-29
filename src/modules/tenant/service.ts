import { getPrisma } from "@/lib/db/prisma";
import type { PanelTheme } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { validateCpfCnpj } from "@/core/billing";

/**
 * `Tenant` não está em `TENANT_SCOPED_MODELS` (é o próprio tenant, não tem coluna `tenantId` —
 * ver src/lib/db/tenant-scope.ts) — por isso usa `getPrisma()` direto, não `forTenant()`.
 * Só é seguro porque `tenantId` chega aqui já validado por `requireTenantMember()` na camada
 * de Server Action (o usuário da sessão precisa ter `Membership` nesse tenant).
 */
export async function updateTenantTheme(tenantId: string, theme: PanelTheme) {
  return getPrisma().tenant.update({
    where: { id: tenantId },
    data: { theme },
    select: { id: true, slug: true, theme: true },
  });
}

/**
 * CPF/CNPJ da empresa (docs/contratos.md, seção Cobrança) — o Mercado Pago exige este dado
 * (`payer.identification`) para criar a cobrança Pix da assinatura (ver
 * `src/modules/billing/mercadopago.ts`). Sempre valida o dígito verificador antes de gravar
 * (nunca confia em "tem 11/14 dígitos" — ver `src/core/billing/document.ts`), porque um
 * documento com dígito errado passaria batido aqui e só quebraria na hora de gerar o Pix, com
 * um erro bem menos claro.
 */
export async function updateTenantDocument(tenantId: string, rawDocument: string) {
  const validated = validateCpfCnpj(rawDocument);
  if (!validated.valid) {
    throw new DomainError("INVALID_DOCUMENT", "CPF ou CNPJ inválido — confira os dígitos.");
  }
  return getPrisma().tenant.update({
    where: { id: tenantId },
    data: { document: validated.digits },
    select: { id: true, slug: true, document: true },
  });
}
