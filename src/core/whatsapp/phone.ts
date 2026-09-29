/**
 * Normalização de telefone a partir de um JID/`ownerJid` da Evolution (docs/arquitetura.md
 * §4, §6.9). Função pura — sem I/O — para ser testável com fixtures, mesmo padrão de
 * `src/core/bot/evolution-normalize.ts`.
 *
 * Reaproveita a lição documentada e validada ao vivo no InnoAtendente (2026-09-05, contato
 * "Junior Rocha"): o JID de MUITOS celulares brasileiros chega SEM o 9º dígito (a Evolution/
 * Baileys não o reconstitui), mesmo quando o número real do cliente tem 9 dígitos. Sem
 * correção, `WhatsappInstance.phoneE164`/`TrialClaim.phoneE164` gravariam um número que não
 * bate com o que o dono do número de fato usa.
 */

/**
 * Só para `+55` (Brasil — nenhum outro código de país é "55", checar o prefixo é seguro). Se o
 * trecho depois do DDD (2 dígitos) tiver exatamente 8 dígitos, insere um "9" na frente. Já com
 * 9 dígitos (ou qualquer outra contagem) devolve sem mexer — só sabemos reconstituir o caso
 * documentado de "faltou exatamente o 9º dígito de celular".
 */
function normalizeBrazilianNinthDigit(digits: string): string {
  if (!digits.startsWith("55")) return digits;

  const ddd = digits.slice(2, 4);
  const subscriber = digits.slice(4);
  if (ddd.length !== 2 || subscriber.length !== 8) return digits;

  return `55${ddd}9${subscriber}`;
}

/**
 * `5511999999999@s.whatsapp.net` → `+5511999999999` (com correção do 9º dígito brasileiro).
 * Devolve `null` para entrada vazia/sem dígitos (ex.: JID malformado) — o chamador decide o que
 * fazer (nunca lança).
 */
export function normalizePhoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const digits = jid.split("@")[0]?.replace(/\D/g, "") ?? "";
  return digits ? `+${normalizeBrazilianNinthDigit(digits)}` : null;
}

/**
 * Telefone digitado por um humano (qualquer formatação: com/sem `+55`, com espaços, parênteses,
 * hífen) → E.164 canônico, só para o padrão brasileiro (DDD de 2 dígitos + assinante de 8 ou 9
 * dígitos, com ou sem o "55" de DDI na frente). `null` para qualquer coisa que não bata com esse
 * formato — o chamador decide o que fazer (nunca lança). Usado por
 * `src/modules/contacts/actions.ts` (cadastro manual de cliente pelo painel).
 */
export function parseBrazilianPhoneToE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  // "55" de DDI já digitado: só remove se o restante ainda bater com DDD+assinante (evita
  // confundir um DDD "55" (não existe, mas por segurança) com o código do país).
  const withoutCountryCode =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;

  if (withoutCountryCode.length !== 10 && withoutCountryCode.length !== 11) return null;

  return `+${normalizeBrazilianNinthDigit(`55${withoutCountryCode}`)}`;
}

/**
 * Inverso aproximado de `normalizeBrazilianNinthDigit`: remove o 9º dígito de um E.164
 * brasileiro de celular, quando presente. Existe só para `phoneE164ToLikelyWhatsappJid` — NÃO
 * usar para exibição nem para comparação de identidade em qualquer outro contexto.
 */
function stripBrazilianNinthDigit(digits: string): string {
  if (!digits.startsWith("55")) return digits;
  const ddd = digits.slice(2, 4);
  const subscriber = digits.slice(4);
  if (ddd.length !== 2 || subscriber.length !== 9 || !subscriber.startsWith("9")) return digits;
  return `55${ddd}${subscriber.slice(1)}`;
}

/**
 * Todos os `waJid` plausíveis (`@s.whatsapp.net`) para um E.164 brasileiro — com e sem o 9º
 * dígito, quando aplicável (deduplicado; para números fora do Brasil só existe uma forma). Usado
 * por `src/modules/contacts/contacts.ts` para PROCURAR um contato de WhatsApp real que já exista
 * com este telefone, ANTES de criar um novo (evita duplicar quando o cliente já mandou mensagem
 * antes de ser cadastrado manualmente pelo painel — nesse caso o `waJid` gravado por
 * `claimMessage`, `src/modules/bot-api/claim.ts`, pode ter vindo com ou sem o 9º dígito).
 *
 * O PRIMEIRO item da lista (`[0]`) é a escolha usada como `waJid` de um `Contact` NOVO — ver
 * `phoneE164ToLikelyWhatsappJid` abaixo para o porquê dessa escolha.
 */
export function whatsappJidCandidatesForPhone(phoneE164: string): string[] {
  const digits = phoneE164.replace(/\D/g, "");
  const withoutNinth = stripBrazilianNinthDigit(digits);
  const uniqueDigits = withoutNinth === digits ? [digits] : [withoutNinth, digits];
  return uniqueDigits.map((d) => `${d}@s.whatsapp.net`);
}

/**
 * Melhor esforço para adivinhar o `waJid` que `claimMessage` (`src/modules/bot-api/claim.ts`) vai
 * gravar quando esse número mandar a primeira mensagem — usado só ao criar um `Contact`
 * manualmente pelo painel, para reduzir a chance de duplicar o contato quando ele de fato
 * conversar pelo WhatsApp depois.
 *
 * IMPORTANTE — isto é uma HEURÍSTICA, não uma garantia: `claimMessage` NUNCA normaliza o
 * `waJid`, ele grava exatamente o `remoteJid` que a Evolution/Baileys mandar. E esse `remoteJid`
 * chega SEM o 9º dígito para MUITOS (não todos) celulares brasileiros — achado documentado e
 * validado ao vivo no InnoAtendente (ver `normalizeBrazilianNinthDigit` acima). Por isso aqui
 * escolhemos o candidato SEM o 9º dígito (`whatsappJidCandidatesForPhone(...)[0]`) para bater com
 * o caso mais comum — mas se o número específico deste cliente for um dos que chegam COM o 9º
 * dígito, `claimMessage` ainda vai criar um segundo `Contact` na primeira mensagem dele.
 * `createContactAction` mitiga a metade que dá para mitigar: verifica na criação, com
 * `whatsappJidCandidatesForPhone`, se já existe um contato de WhatsApp real com QUALQUER uma das
 * formas possíveis deste telefone — ou seja, cobre o caso "cliente já tinha mandado mensagem
 * antes de ser cadastrado no painel", que é o caso em que dava para checar de verdade.
 */
export function phoneE164ToLikelyWhatsappJid(phoneE164: string): string {
  return whatsappJidCandidatesForPhone(phoneE164)[0];
}
