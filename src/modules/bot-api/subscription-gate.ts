/**
 * Bloqueio do bot por assinatura (docs/arquitetura.md §2 regra 8, §7.4): `claimMessage` chama
 * isto e devolve `ignore/TENANT_SUSPENDED` quando `false`.
 *
 * TODO (Fase 7, cobrança — Cronos/Vega): substituir por
 * `effectiveStatus(subscription, now) !== "SUSPENDED" && !== "CANCELED"`, quando `Subscription`
 * existir no schema. Até lá, sempre `true` — nenhum tenant é bloqueado por falta de pagamento
 * (não há cobrança implementada ainda), decisão consciente para não travar a Fase 4 numa
 * dependência da Fase 7.
 */
export async function isTenantBotAllowed(tenantId: string): Promise<boolean> {
  void tenantId; // parâmetro mantido pela assinatura futura (Fase 7) — sem uso ainda.
  return true;
}
