-- Desfazer "Concluído"/"Faltou": novo tipo de evento na trilha do agendamento. 100% aditiva
-- (código antigo nunca grava nem lê REOPENED). ADD VALUE roda dentro da transação da migration
-- (PostgreSQL >= 12), desde que o valor novo não seja USADO nesta mesma migration — não é.
ALTER TYPE "AppointmentEventAction" ADD VALUE IF NOT EXISTS 'REOPENED';
