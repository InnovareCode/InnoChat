---
name: toast-aria-live-duplica-texto
description: O Toast do Radix cria uma cópia do texto numa região aria-live; getByText de mensagem de toast sem .first() dá strict-mode violation intermitente
metadata:
  type: feedback
---

Em 2026-09-29, a suíte completa passou numa rodada e falhou na seguinte em testes diferentes
("Não foi possível ativar o bot", "Clientes" na paleta Ctrl+K). Causa: o Toast do Radix renderiza
uma cópia do texto num `<span role="status" aria-live>` para leitor de tela, e a presença dela depende
de timing. Com isso, `page.getByText(msg)` às vezes encontra 2 elementos.

**Why:** gerou falhas intermitentes que parecem flake e custam rodadas inteiras de 6 min.

**How to apply:** asserções de texto de toast ou mensagem sempre com `.first()` (o Atlas aplicou em
47 pontos). Botões com nome que contém outro nome ("Novo cliente" contém "Clientes") usam
`{ exact: true }`. Validado em 2 rodadas seguidas de 123/123.
