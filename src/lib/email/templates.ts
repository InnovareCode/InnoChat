/**
 * Templates de e-mail pt-BR (texto simples, sem HTML sofisticado — v1). Cada função devolve
 * `{ subject, html, text }`, pronto para `sendMail` (mailer.ts). `html` é o `text` com quebras
 * de linha convertidas — nenhum template tem link/dado que precise de escaping além do já
 * validado antes de chegar aqui (URLs geradas pelo próprio código, nunca eco de input livre do
 * usuário sem sanitização).
 */

function toHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family: sans-serif; white-space: pre-line;">${escaped}</div>`;
}

function template(subject: string, text: string) {
  return { subject, text, html: toHtml(text) };
}

export function verificationEmail(params: { verifyUrl: string }) {
  return template(
    "Confirme seu e-mail — InnoChat",
    `Olá!\n\nPara ativar sua conta no InnoChat e poder conectar seu WhatsApp, confirme seu e-mail:\n\n${params.verifyUrl}\n\nSe você não fez este cadastro, ignore esta mensagem.`,
  );
}

export function passwordResetEmail(params: { resetUrl: string }) {
  return template(
    "Redefinir sua senha — InnoChat",
    `Recebemos um pedido para redefinir sua senha no InnoChat.\n\nClique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n${params.resetUrl}\n\nSe você não pediu isso, ignore esta mensagem — sua senha continua a mesma.`,
  );
}

export function teamInviteEmail(params: { tenantName: string; inviteUrl: string }) {
  return template(
    `Convite para ${params.tenantName} — InnoChat`,
    `Você foi convidado para fazer parte da equipe de "${params.tenantName}" no InnoChat.\n\nAceite o convite (válido por 7 dias):\n\n${params.inviteUrl}`,
  );
}

export function invoiceGeneratedEmail(params: { tenantName: string; amountReais: string; dueDateBr: string; pixCopyPaste: string; billingUrl: string }) {
  return template(
    `Fatura disponível — ${params.tenantName}`,
    `Sua fatura de ${params.amountReais} está disponível, com vencimento em ${params.dueDateBr}.\n\nPague com Pix (copie e cole no seu banco):\n\n${params.pixCopyPaste}\n\nOu acesse a tela de Assinatura para ver o QR code:\n${params.billingUrl}`,
  );
}

export function invoiceDueReminderEmail(params: { tenantName: string; amountReais: string; dueDateBr: string; billingUrl: string; dueToday: boolean }) {
  const when = params.dueToday ? "vence hoje" : "vence amanhã";
  return template(
    `Sua fatura ${when} — ${params.tenantName}`,
    `Sua fatura de ${params.amountReais} ${when} (${params.dueDateBr}).\n\nPague com Pix pela tela de Assinatura para evitar a suspensão do atendimento por WhatsApp:\n${params.billingUrl}`,
  );
}

export function subscriptionSuspendedEmail(params: { tenantName: string; billingUrl: string }) {
  return template(
    `Atendimento por WhatsApp suspenso — ${params.tenantName}`,
    `O atendimento automático por WhatsApp de "${params.tenantName}" foi suspenso por falta de pagamento.\n\nO painel continua acessível só para leitura (agenda e clientes). Pague a fatura em aberto para reativar o atendimento:\n${params.billingUrl}`,
  );
}
