---
name: platform-secrets-encryption
description: Segredos de PlatformSettings cifrados (enc:v1:, chave do AUTH_SECRET), migração preguiçosa, par MP prod/sandbox e o que NÃO fazer ao ler segredo
metadata:
  type: project
---

Segredos da plataforma (evolution/n8n/smtp/MP) são cifrados por `src/lib/crypto.ts` (`enc:v1:`,
AES-256-GCM, scrypt do `AUTH_SECRET`). `decryptSecret` devolve `null` (fail-closed), nunca lança.
Migração preguiçosa em `src/modules/platform/secrets.ts#loadPlatformSettingsRow` (compare-and-set
via `updateMany` com guard nos valores lidos). Par MP: `mercadopago-config.ts`.

**Regra:** nenhum código faz `platformSettings.findUnique` pedindo coluna de segredo — sempre
`loadPlatformSettingsRow`/`getPlatformSecrets`/`getActiveMercadoPagoCredentials`. Webhook usa
`getMercadoPagoGateway()` (sem checar `mpEnabled`); cobrança nova usa `{ forNewCharge: true }`.
Testes de integração que semeiam segredo devem usar as colunas novas (`mpProd*Enc` via
`encryptSecret`) e limpar o par no afterAll — senão o legado é descartado se o par já existir.
Tipos do Prisma (`Prisma`, `PlatformSettings`) reexportados em `src/lib/db/types.ts` (ESLint proíbe
`@prisma/client` fora de `src/lib/db/`). Bloqueio do classificador: `migrate deploy` (dev + wrapper
de teste) foi negado uma vez em 2026-09-29 — não repetir, pedir ao Atlas/dono.
