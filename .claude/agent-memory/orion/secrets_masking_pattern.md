---
name: secrets_masking_pattern
description: Padrão de mascaramento de segredos do InnoChat (PlatformSettings) — referência para julgar se um campo novo de segredo foi exposto corretamente
metadata:
  type: project
---

`src/modules/platform/service.ts` é o padrão de referência: todo campo sensível de
`PlatformSettings` (Evolution, n8n, Mercado Pago, SMTP) só sai da função `toView()` mascarado
(`maskSecret`, últimos 4 caracteres) ou como booleano `configured` — nunca em texto puro.
`internalApiSecretHash` é hash SHA-256, nunca sai de `regenerateInternalApiSecret`/
`verifyInternalApiSecret` (comparação via `crypto.timingSafeEqual`), e o segredo em texto puro só
existe no instante em que é gerado (rota de retorno da própria action, nunca lido de volta do
banco). `syncN8n()` (`src/modules/platform/n8n-sync.ts`) gera um segredo NOVO a cada
sincronização — rotação automática.

**Dívida consciente e já documentada** (não é um achado novo): os campos de segredo em
`PlatformSettings` ficam em texto puro no Postgres (sem cifragem em repouso). Propus, na
auditoria de 2026-09-28, cifrar com AES-256-GCM usando uma chave derivada de `AUTH_SECRET` via
HKDF/scrypt (nunca usar `AUTH_SECRET` bruto como chave — ele já serve para JWT). Não implementei;
é decisão para Vega/Cronos.

**ATUALIZAÇÃO 2026-09-29:** a dívida acima FOI paga (auditoria aprovada, 0 críticos):
`src/lib/crypto.ts` (AES-256-GCM, IV aleatório 12B, scrypt do AUTH_SECRET, fail-closed null) +
`src/modules/platform/secrets.ts` (migração preguiçosa com compare-and-set; leitura só via
`loadPlatformSettingsRow`). Pontos residuais: sem AAD ligando ciphertext à coluna; chave acoplada ao
AUTH_SECRET (que também assina JWT); logs de mudança do MP sem o id do ator.

**Ao revisar um campo de segredo NOVO** neste projeto: confirmar que (1) tem uma versão
`*Masked`/`*Configured` na view exposta ao client, (2) `updatePlatformSettings`/`keepIfEmpty`
trata string vazia como "manter o valor atual" (nunca apaga um segredo sem querer), (3) nenhum
log em volta devolve o valor bruto.

Ver também [[tenant_isolation_pattern]].
