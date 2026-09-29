---
name: whatsapp-phone-mockup
description: Card de número WhatsApp como celular em CSS puro; armadilhas de E2E (rounded-card, rótulo único, nomes de botão) e de escala mobile
metadata:
  type: project
---

Card do número em `src/components/whatsapp/` (`phone-mockup.tsx`, `whatsapp-instance-card.tsx`, `use-instance-qr.ts`, `add-number-card.tsx`).

- **E2E acopla no DOM:** acha o card por `ancestor::div[contains(@class,'rounded-card')]` a partir do texto EXATO do rótulo. Então: nada do mockup usa `rounded-card`; o rótulo aparece como nó de texto só uma vez (no celular o nome vem de `data-name` + `::after`); botão novo não pode conter "Conectar número"/"Desconectar"/"Remover"/"Atualizar status" no nome (getByRole é por substring). Remover virou botão só-ícone com `aria-label="Remover"`.
- **Celular escalado no mobile (0.85):** alvo de 44px real exige `h-[52px]` dentro da tela (`sm:h-11`). Medir com getBoundingClientRect, não deduzir.
- **QR de instância existente:** `getQrCodeAction` funciona para QRCODE e DISCONNECTED (não cria instância). "Reconectar" reaproveita isso; não reabre o diálogo de criação (uma desconectada ainda ocupa vaga do plano).
- Medição: `next dev` da pasta é único (lock); usar o dev já rodando em :3000 e um script tsx temporário com Playwright + proxy Evolution que devolve QR real (pacote `qrcode`). Em `page.evaluate` sob tsx, injetar `window.__name = f => f` (senão "__name is not defined").
- Shell: heredoc com python misturado a `'` quebrava o bash inteiro sem rodar nada; use Write/Edit para arquivos.
