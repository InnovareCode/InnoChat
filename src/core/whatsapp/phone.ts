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
