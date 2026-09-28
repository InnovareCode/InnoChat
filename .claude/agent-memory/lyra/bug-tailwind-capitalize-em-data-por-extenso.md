---
name: bug-tailwind-capitalize-em-data-por-extenso
description: "Segunda-Feira, 05 De Outubro" na Agenda não era bug do Intl/toLocaleDateString — era a classe Tailwind `capitalize` deixando maiúscula a primeira letra de CADA palavra
metadata:
  type: feedback
---

Achado do Atlas em 2026-09-28, na Fase 2 da Agenda: `formatHeaderDate` usava
`toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })`
e o `<p>` tinha a classe Tailwind `capitalize`. O `Intl` já devolve a string
certa e minúscula ("segunda-feira, 05 de outubro") — o problema inteiro era
`text-transform: capitalize` do CSS, que maiuscula a primeira letra de **cada
palavra separada por espaço**, não só a primeira da frase. Resultado:
"Segunda-Feira, 05 De Outubro".

**Why:** `capitalize` (CSS) e "capitalizar uma frase" (o que se queria) não
são a mesma operação — isso é fácil de não notar porque em textos curtos de
uma palavra (ex. um badge "ativo" → "Ativo") o efeito é idêntico, então o
bug só aparece em textos por extenso com mais de uma palavra (datas, nomes
compostos).

**How to apply:** nunca usar a classe `capitalize`/`uppercase`/`lowercase` do
Tailwind em cima de uma string com mais de uma palavra vinda de `Intl`/
`toLocaleDateString` — capitalizar só a primeira letra em JS
(`capitalizeFirst`, ver `src/components/lib/format-date.ts`). Também troquei
`day: "2-digit"` por `day: "numeric"` no mesmo bug: o padrão pt-BR para data
por extenso não usa zero à esquerda ("5 de outubro", não "05 de outubro") —
`2-digit` só cabe em formato numérico curto (dd/MM/yyyy).

Centralizei toda formatação de data/hora do painel em
`src/components/lib/format-date.ts` (não repetir `toLocaleDateString`/
`toLocaleTimeString` cru pelos componentes) — inclui nome de fuso amigável
(`friendlyTimezoneLabel`, mapa de fusos brasileiros + fallback `Intl`
`timeZoneName: "long"`, nunca o identificador IANA técnico na UI).
