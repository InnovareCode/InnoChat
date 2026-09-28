---
name: fase7-cobranca-e-cadastro-publico
description: Padrões usados nas telas de cadastro público, assinatura e mensagens do bot (Fase 7) — reaproveitar em vez de redescobrir
metadata:
  type: project
---

Implementado em 2026-09-28: cadastro público, verificar e-mail, recuperar/redefinir senha,
aceitar convite, onboarding em 4 passos, `/[tenantSlug]/assinatura`, admin de planos/empresas,
Mercado Pago em admin/configurações, equipe (convite) e "Mensagens do bot".

**Padrões que valem para telas futuras:**

- **Leitura simples direto no Server Component, sem Server Action nova.** Quando só falta um
  `SELECT` (sem regra de negócio) para uma tela — ex.: fatura aberta + assinatura em
  `assinatura/page.tsx`, membros da equipe em `configuracoes/equipe/page.tsx` — importar
  `getPrisma()`/`forTenant()` direto no `page.tsx` (Server Component) é o padrão já estabelecido
  no projeto (`layout.tsx` do tenant/admin já fazem isso). Evita esperar por uma Server Action
  nova da Vega só para um `findFirst`. Só decisão de negócio (mutação, validação) precisa de
  Server Action.
- **`router.refresh()` como polling sem Server Action nova.** Para "atualização periódica de
  status" (ex.: tela de Assinatura esperando o Pix cair), um `setInterval(() => router.refresh(),
  ms)` num client component re-executa o Server Component pai (que relê o banco) sem precisar
  expor uma Server Action só para leitura repetida. Parar de repetir quando a condição de espera
  (`invoice.paidAt` nulo) deixa de valer.
- **QR code do Pix é gerado no cliente a partir do copia-e-cola.** O gateway do Mercado Pago
  (`src/modules/billing/mercadopago.ts`) só grava `pixCopyPaste` (string EMV/BR Code) — não tem
  `qr_code_base64`. Instalei `qrcode` (+ `@types/qrcode` dev) e gero a imagem com
  `QRCode.toDataURL(copyPaste)` no client — é a forma correta (o "QR" da Pix É o mesmo payload
  do copia-e-cola codificado), não uma gambiarra. Ver `assinatura-client.tsx`.
- **Item de nav condicional por dado de banco (ex.: onboarding incompleto) nunca cruza a
  fronteira servidor/cliente como objeto com ícone** — mesma lição de
  [[bug-icone-server-para-client]]. Resolvido passando um **booleano** (`onboardingIncomplete`)
  do `layout.tsx` até `TenantSidebarNav`/`MobileNav`, que decidem localmente (client) se incluem
  o item `Rocket` de `nav-items.ts` — nunca um `NavItem[]` montado no servidor.
- **Textos do bot agrupados por etapa e descrição humana são conteúdo de UI, não de domínio.**
  `KEY_DESCRIPTION`/`GROUPS` em `mensagens-bot-client.tsx` duplicam de propósito uma categorização
  que não existe em `src/core/bot/texts.ts` (que só tem a lista de chaves) — é motivação de tela,
  não regra de negócio, então mora em `src/app`.
- **Pendência real, não implementada por ficar fora da posse (`src/modules/**` é da Vega):**
  não há Server Action para "trocar de plano" (`Subscription.pendingPlanId` existe no schema mas
  nenhuma action grava nele) — a tela de Assinatura não oferece essa opção ainda.
