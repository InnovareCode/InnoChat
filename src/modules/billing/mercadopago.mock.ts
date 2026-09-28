import type { CreatePixPaymentInput, MercadoPagoGateway, MercadoPagoPayment } from "./mercadopago";

/**
 * Fake do Mercado Pago para testes (sem credenciais reais ainda — PENDÊNCIAS no handoff da
 * Fase 7). Implementa `MercadoPagoGateway` de verdade — os testes injetam isto no lugar do
 * gateway real (`createMercadoPagoGateway`) nas funções de serviço que aceitam `gateway?` como
 * parâmetro, e usam `approve()`/`setStatus()` para simular o webhook confirmando o pagamento.
 */
export function createMockMercadoPagoGateway() {
  let counter = 0;
  const payments = new Map<string, MercadoPagoPayment & { copyPaste: string }>();

  const gateway: MercadoPagoGateway = {
    async createPixPayment(input: CreatePixPaymentInput) {
      counter += 1;
      const paymentId = `mock_pay_${counter}`;
      payments.set(paymentId, {
        id: paymentId,
        status: "pending",
        dateApproved: null,
        externalReference: input.externalReference,
        copyPaste: `00020126mock-pix-${paymentId}`,
      });
      return {
        paymentId,
        qrCode: `mock-qr-${paymentId}`,
        copyPaste: `00020126mock-pix-${paymentId}`,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };
    },

    async getPayment(paymentId: string) {
      const payment = payments.get(paymentId);
      if (!payment) throw new Error(`mock: pagamento ${paymentId} não existe`);
      return payment;
    },
  };

  return {
    gateway,
    /** Simula a aprovação do pagamento (o que o webhook reconsulta via `getPayment`). */
    approve(paymentId: string, approvedAt: Date = new Date()) {
      const payment = payments.get(paymentId);
      if (!payment) throw new Error(`mock: pagamento ${paymentId} não existe`);
      payment.status = "approved";
      payment.dateApproved = approvedAt;
    },
  };
}
