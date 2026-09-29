---
name: contact-source-derived-from-wajid
description: Contact.source (WHATSAPP/PANEL) na tela de Clientes é 100% calculado da forma do waJid — não existe campo de origem separado, e isso trava edição de telefone mesmo para contato criado manualmente
metadata:
  type: project
---

`src/modules/contacts/contacts.ts#contactSource()`: `source: "PANEL"` só quando `waJid` termina em
`@panel.local` (o padrão sintético antigo de `createAppointmentAction` sem `contactId`, sem
telefone). Qualquer outra forma (`@s.whatsapp.net`) → `"WHATSAPP"`.

**Pegadinha real**: como `createContactAction`/`updateContactAction` deliberadamente gravam um
`waJid` `@s.whatsapp.net` para telefones reais (ver [[contact_wajid_dedup_heuristic]] — é assim
que evitam duplicar quando o bot processar a primeira mensagem), um cliente cadastrado À MÃO no
painel com telefone aparece como `source: "WHATSAPP"` na tela, mesmo nunca tendo mandado mensagem
nenhuma. Isso NÃO é bug — é a definição literal do contrato fixado pelo Atlas
(`source = PANEL quando o waJid for sintético @panel.local`), mas é contraintuitivo o suficiente
para valer registrar.

Consequência em cascata: `updateContactAction` bloqueia edição de telefone
(`PHONE_LOCKED`) sempre que `source === "WHATSAPP"` — ou seja, também bloqueia um contato recém
cadastrado manualmente. A justificativa (documentada em `docs/contratos.md`) é que, uma vez que o
`waJid` foi derivado do telefone (mesmo que só adivinhado), trocar o telefone sem trocar o `waJid`
quebra o casamento com a próxima mensagem real do cliente — então o lock faz sentido tecnicamente,
mesmo soando estranho de "por que não posso editar algo que acabei de digitar".

**Se o dono/Atlas achar essa UX ruim**: a correção correta é um campo novo `Contact.origin`
(`"PANEL" | "WHATSAPP"`, populado na criação, nunca recalculado) — mudança de schema, fora do
escopo da Fase 8. Registrado como PENDÊNCIA em `docs/contratos.md` § Clientes, não implementado
em silêncio.
