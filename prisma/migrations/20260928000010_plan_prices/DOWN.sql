-- Rollback manual (best-effort, Prisma nao roda DOWN automaticamente): so reverte planos que
-- estao EXATAMENTE nos valores aplicados por esta migration -- se o dono editou o preco depois,
-- este DOWN nao toca (mesma cautela do UP: nunca sobrescrever edicao humana).

UPDATE "plans"
SET "priceCents" = 0, active = false
FROM (
  VALUES
    ('essencial', 5990),
    ('profissional', 10990),
    ('clinica', 18990)
) AS v(code, "priceCents")
WHERE "plans".code = v.code
  AND "plans"."priceCents" = v."priceCents"
  AND "plans".active = true;
