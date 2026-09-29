---
name: bugs-found-log-round3
description: Achados da rodada C1 (visual premium, Clientes, drag, Ctrl+K, admin Cobrança/Saúde, dados jurídicos) — 2026-09-29
metadata:
  type: project
---

Rodada de QA do C1 (`docs/plano-implementacao.md`) — 2026-09-29.

1. **[MÉDIA] Ponto vermelho "precisa de atenção" (nav do WhatsApp) fica invisível quando o grupo
   colapsável "Canal" está fechado.** `sidebar-nav.tsx`: o `<NavRow>` (onde o `<span title="Precisa
   de atenção">` vive) só existe no DOM quando `openGroups.includes(group.id)`. Como só o grupo da
   rota ATIVA abre sozinho, um dono navegando em "Agenda" nunca vê o alerta do WhatsApp precisar de
   atenção — o propósito inteiro de um indicador persistente de navegação é justamente avisar
   quando você NÃO está naquela seção. Teste `whatsapp.spec.ts` ("ponto vermelho na nav") deixado
   FALHANDO de propósito (não é bug do teste) para documentar isso — não corrigido aqui por
   instrução explícita de não mexer em `src/**`. PARA O PRÓXIMO: Lyra decide entre (a) mostrar o
   ponto agregado no cabeçalho do GRUPO quando fechado, ou (b) manter os grupos com alerta sempre
   abertos.

2. **[BAIXA/arquitetura] `updatePlatformLegalInfoAction` não chama `revalidatePath`.** `/termos` e
   `/privacidade` usam `export const revalidate = 60` (ISR). Em produção (`next build && next
   start`), salvar os dados jurídicos em Configurações pode ficar até 60s sem refletir nas páginas
   públicas — em `next dev` não reproduz (sem cache estático persistente), por isso passou aqui
   sem quebrar o teste. PARA O PRÓXIMO: Vega adicionar `revalidatePath("/termos")` e
   `revalidatePath("/privacidade")` dentro de `updatePlatformLegalInfoAction`
   (`src/modules/platform/actions.ts`).

3. **[Não é bug — gap de teste]** Ver [[mercadopago_no_fake_server]]: Mercado Pago não pode ser
   testado com servidor HTTP fake local (API_BASE fixo, sem override em `PlatformSettings`).

4. **[Não é bug — pollution de dados]** DB de dev tinha lixo de execuções anteriores ("Profissional
   QA" + serviço "Escova Modeladora QA", sem vínculo com Ana/Bruna) que quebrava o teste de arraste
   (serviço padrão do `<select>` não era um que a profissional atendia). Limpo nesta rodada. Se
   voltar a aparecer, é sinal de alguma suíte/sessão manual não rodando o teardown até o fim.

Ver também [[bugs_found_log]] e [[bugs_found_log_round2]] (rodadas anteriores).
