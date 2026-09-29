---
name: emails-transacionais-layout
description: Arquitetura dos e-mails do InnoChat (layout.ts, ctx, recibo, preview) e armadilhas
metadata:
  type: project
---

Templates em `src/lib/email/templates.ts` usam `layout.ts` (blocos + `esc()`); marca/rodapé vêm de `ctx` (`loadEmailContext()`, nunca lança). Imagens PNG em `public/marca/email-*.png` (logo 560x240 fundo navy achatado, avatar do Inno). Recibo sai de `applyInvoicePayment` (ponto único de baixa), fora da transação, com timeout 10 s. Preview: `npx tsx scripts/email-preview.ts --shots`.

**Why:** e-mail não aceita webp/transparência; baixa passa por um só lugar, então reenvio é impedido pelo UPDATE condicional.
**How to apply:** template novo = usar blocos do layout + receber `ctx`; nunca concatenar dado sem `esc()`. Heredoc com aspas no Bash tool falhou aqui — usar Write. Dark mode do Gmail (inversão automática) não é reproduzível no Playwright.
