---
name: seed-tenant-plan-limit-e2e
description: O tenant de seed (studio-demo) fica no limite de 3 profissionais por causa de um leftover manual ("Profissional QA", com 1 agendamento pendurado) — E2E que cria profissional precisa de override temporário
metadata:
  type: project
---

`studio-demo` (seed) tem Ana + Bruna (2 profissionais) e o plano padrão do trial tem
`maxProfessionals: 3`. Em algum momento anterior a esta sessão, alguém (dev/QA manual) criou um
terceiro profissional "Profissional QA" com 1 `Appointment` pendurado — deletar direto pelo
Prisma cascadeia e apaga esse agendamento sem saber a que serve, então não é seguro remover sem
perguntar ao dono.

**Como aplicar:** qualquer E2E que precise CRIAR um profissional na empresa de seed sobe
`Tenant.maxProfessionalsOverride` temporariamente (`tests/e2e/global-setup.ts`) e devolve para
`null` no `global-teardown.ts` — nunca mexe no "Profissional QA" em si. Ver
[[e2e_suite_layout]] para onde isso está implementado.
