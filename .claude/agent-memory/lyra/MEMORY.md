# Memória — Lyra (InnoChat)

- [Lição: não portar visual sem números](licao-nao-portar-visual-sem-numeros.md) — usar hex/rem/opacidade concretos, nunca só adjetivo; medir no navegador antes de declarar pronto.
- [Proposta de direção visual (3 opções)](direcao-visual-proposta.md) — histórico; decisão fechada em 2026-09-28 (temas prontos por empresa).
- [Sistema de temas em runtime (Tailwind v4)](sistema-de-temas-tailwind-v4.md) — arquitetura de tokens/fontes/root layouts implementada na Fase 1; pendência de cor de alerta do Âmbar.
- [Bug: ícone como prop server→client quebra o build](bug-icone-server-para-client.md) — nunca passar componente React (ex. LucideIcon) como prop de Server para Client Component.
- [Auth.js v5 signIn redirect:false lança, não retorna](authjs-v5-signin-redirect-false.md) — sempre `try/catch AuthError`, não confiar só na leitura do código-fonte da lib.
- [eslint react-hooks/set-state-in-effect bloqueia fetch-on-mount direto](react-hooks-set-state-in-effect.md) — envolver em `setTimeout(fn, 0)` + `clearTimeout` no cleanup.
- [Bug: `capitalize` do Tailwind em data por extenso](bug-tailwind-capitalize-em-data-por-extenso.md) — maiuscula CADA palavra, não a frase; capitalizar em JS. Util central: `src/components/lib/format-date.ts`.
- [Fase 7 — cobrança e cadastro público](fase7-cobranca-e-cadastro-publico.md) — leitura direta em Server Component, `router.refresh()` como polling, QR Pix gerado no cliente com `qrcode`, nav condicional por booleano.
- [Fase 3 — WhatsApp QR](fase3-whatsapp-qr.md) — componente único de conexão reaproveitado no onboarding; timer de longa duração precisa de `ref`, não `state`, para ler o valor mais recente.
