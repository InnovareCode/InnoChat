---
name: painel-mercado-pago-e-dev-db
description: Painel Mercado Pago do admin (2 cards por ambiente, ações imediatas) e a armadilha de screenshot quando a migration da Vega não está aplicada no banco local.
metadata:
  type: project
---

Painel: `src/components/admin/mercado-pago-{panel,credentials-card,types}`. Espelha o PaymentGateway do Parque das Feiras,
mas ambiente/cobrança são ações IMEDIATAS (contrato da Vega), não rascunho+salvar. Diálogo de confirmação (produção/remover)
único e sempre montado. Card de status "Mercado Pago" do checklist reage via `onConfigChange` (mpConfig no pai).

**Armadilha:** `next dev` local quebra a página com "column mpEnvironment does not exist" quando a migration nova da Vega
não foi aplicada; `prisma migrate deploy` é negado pelo classificador de permissão -> pedir ao Atlas/dono aplicar, não contornar.
Script de screenshot (login + 1440/768/360) ficou no scratchpad da sessão; refazer com playwright chromium.
**Validar tipos antes da Vega:** tsconfig temporário com `paths` apontando a um stub fora de `src/` (apagar depois) — não mexe em `src/modules`.
