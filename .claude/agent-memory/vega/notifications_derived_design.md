---
name: notifications-derived-design
description: Central de notificações do painel é DERIVADA (sem tabela Notification); leitura em Membership+NotificationRead; trigger preenche AppointmentEvent.tenantId
metadata:
  type: project
---

Notificações (2026-09-29) derivam de AppointmentEvent/Appointment/WhatsappInstance/Subscription/Invoice. Estado de leitura: `Membership.notificationsReadAllAt` + `NotificationRead`.

**Why:** derivar elimina o risco de esquecer um ponto de escrita (painel, bot, drag, tick). `AppointmentEvent.tenantId` (nullable) é preenchido por TRIGGER no Postgres (migration 20260930100000) — poll barato via índice (tenantId, createdAt) sem join, e código antigo durante o deploy não quebra.

**How to apply:** ao criar novos pontos que gravam AppointmentEvent, não precisa informar tenantId. `disconnectedAt` em WhatsappInstance só é carimbado na transição CONNECTED→DISCONNECTED inesperada e zerado em reconexão/desconexão manual/remoção — qualquer novo ponto que escreva status DISCONNECTED/CONNECTED deve seguir isso. Armadilha: `date-fns` ptBR `EEE` devolve "quinta" (nome inteiro), não "qui" — usar tabela própria. Testes que criam vários Appointments do mesmo profissional em horários próximos batem no EXCLUDE: um profissional por agendamento.
