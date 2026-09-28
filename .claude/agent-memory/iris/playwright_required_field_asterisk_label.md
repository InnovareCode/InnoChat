---
name: playwright-required-field-asterisk-label
description: getByLabel com { exact: true } falha em qualquer campo obrigatório do InnoChat porque o componente Field acrescenta " *" ao texto do label — achado repetidamente em vários specs novos
metadata:
  type: project
---

`src/components/ui/field.tsx` (`Field`) renderiza `{label}{required ? <span> *</span> : null}` —
todo campo com `required` tem o nome acessível `"<Label> *"`, NUNCA só `"<Label>"`. Usar
`page.getByLabel("Senha", { exact: true })` num campo `required` nunca encontra o elemento
(timeout de 30s, sem violação de modo estrito — é falta de match, não ambiguidade), porque o
texto real é `"Senha *"`.

**Como aplicar:** ao escrever `getByLabel(..., { exact: true })` para um campo novo, primeiro
`grep -n "required" <arquivo-do-form>` para saber se ele tem essa prop — se tiver, o locator
exato precisa incluir o `" *"` (ex.: `getByLabel("Senha *", { exact: true })`) ou trocar para
substring (sem `exact`) quando não há ambiguidade com outro campo (ex.: "Confirmar senha").
Quando HÁ dois campos que colidem por substring (`"Senha"` dentro de `"Confirmar senha"`), o
`exact: true` com o asterisco é a única forma limpa de distinguir.

Achado nos specs `cadastro.spec.ts`, `instalacao.spec.ts` e `whatsapp.spec.ts` (campo "Rótulo").
