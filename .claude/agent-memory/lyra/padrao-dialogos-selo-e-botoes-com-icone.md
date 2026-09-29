---
name: padrao-dialogos-selo-e-botoes-com-icone
description: Padrão de diálogos (DialogHeader com selo de ícone + tom) e Button com prop icon; mapa diálogo→ícone; armadilhas medidas (Fechar 24px, tabela oculta no mobile, Início com saudação)
metadata:
  type: project
---

- Todo diálogo usa `<DialogHeader icon={...} tone?>` envolvendo `DialogTitle`+`DialogDescription` (`src/components/ui/dialog.tsx`). Tons: primary (padrão), danger, warning, success. Entidade = `navIconFor(seção)`; ação destrutiva = ícone de ação + danger. O selo é `aria-hidden` (`data-dialog-icon`).
- `Button` tem `icon` (LucideIcon, 16px, some com `isLoading`, ignorado com `asChild`) e variantes `success` (sólido) e `warning` (tintado — branco sobre âmbar não passa AA). Ícone não muda o nome acessível: E2E `getByRole('button',{name})` segue igual.
- **Why:** dono pediu (2026-09-29) título com ícone e ícones nos botões em todas as telas de cadastro/informação. **How to apply:** diálogo novo = DialogHeader + `icon` nos botões; nunca componente de ícone como prop Server→Client (ver [[bug-icone-server-para-client]]).
- Armadilha medida: o "Fechar" do diálogo era 24px (violava 44px) — agora h-11 w-11 alinhado ao selo. Sempre medir `buttonsUnder44` dentro do diálogo.
- Armadilha E2E/medição: em 390 a lista de Agendamentos/Clientes esconde a `<table>` (cards no mobile) → `getByText(...).filter({visible:true})`.
- Início: saudação por hora NO fuso da empresa (`components/lib/greeting.ts`, testado), nome vem do e-mail (User não tem `name`), chips reais em `inicio/inicio-header.tsx`; `cache()` compartilha `getDashboardView` entre cabeçalho e conteúdo. Chip-link amplia alvo com `after:-inset-y-2`.
- Agendamento: Concluir/Faltou só habilitam após `startsAt` (estado `now` atualizado a cada 30 s, não `Date.now()` no render); override local de status + `refreshKey` da timeline; Reabrir para COMPLETED/NO_SHOW.
