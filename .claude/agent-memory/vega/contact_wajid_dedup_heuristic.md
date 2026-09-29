---
name: contact-wajid-dedup-heuristic
description: Como criar/editar um Contact pelo painel com waJid compatível com o que claimMessage vai gravar de verdade — heurística do 9º dígito e como isso limita o dedup
metadata:
  type: project
---

`claimMessage` (`src/modules/bot-api/claim.ts`) NUNCA normaliza `waJid` — grava exatamente o
`remoteJid` que a Evolution/Baileys mandar. Muitos (não todos) celulares brasileiros chegam SEM o
9º dígito nesse `remoteJid` (achado documentado desde o InnoAtendente, ver
`normalizeBrazilianNinthDigit` em `src/core/whatsapp/phone.ts`).

Consequência para qualquer feature que crie um `Contact` a partir de um telefone digitado (não de
uma mensagem real recebida): se o `waJid` gravado não bater com o que o cliente realmente vai
gerar na primeira mensagem, `claimMessage` cria um SEGUNDO `Contact` (duplicado).

**Solução usada em `src/modules/contacts/contacts.ts` (Fase 8, gestão de clientes)**:
- `phoneE164ToLikelyWhatsappJid(phoneE164)` (`core/whatsapp/phone.ts`): escolhe o candidato SEM o
  9º dígito como `waJid` de um `Contact` novo — bate com o caso mais comum. É HEURÍSTICA, não
  garantia; se o número específico do cliente for um dos que chegam COM o 9º dígito, ainda
  duplica na primeira mensagem real dele. Limitação conhecida e aceita, documentada em
  docs/contratos.md § Clientes → PENDÊNCIAS.
- `whatsappJidCandidatesForPhone(phoneE164)`: as duas formas plausíveis (com/sem o 9º dígito) —
  usar para PROCURAR (nunca para gravar) um `Contact` de WhatsApp real já existente com este
  telefone antes de criar um novo. Cobre o caso "cliente já mandou mensagem antes de ser
  cadastrado no painel" — o único caso em que dava para checar de verdade (o outro caso, "vai
  mandar no futuro com o formato que a gente não escolheu", não tem solução sem tocar em
  `claim.ts`).

**Se algum dia quiser reconciliar os dois `Contact` de um mesmo cliente** (um `@panel.local`/
`@s.whatsapp.net` adivinhado + um real criado depois por `claimMessage`): não existe hoje. Teria
que casar por `phoneE164` quando os dois existirem e fazer um merge — fora do escopo desta
rodada, precisa de decisão de produto (qual `Contact.id` sobrevive, o que fazer com o histórico
de `Appointment` do outro).

Ver também [[contact_source_derived_from_wajid]].
