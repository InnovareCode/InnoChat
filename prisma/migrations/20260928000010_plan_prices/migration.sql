-- Data migration (nao altera schema): aplica os precos aprovados pelo dono para os 3 planos
-- (Essencial R$ 59,90 / Profissional R$ 109,90 / Clinica R$ 189,90) e os ativa.
--
-- Idempotente e seguro para rodar em qualquer ambiente:
-- 1. Cria os planos que ainda nao existem (producao nasce vazia -- prisma/seed.ts nao roda em
--    producao, ver comentario no proprio seed).
-- 2. Para planos JA existentes (criados pelo seed em dev com priceCents=0, active=false -- ver
--    "Fase 7" em prisma/seed.ts), aplica o preco/ativacao.
-- 3. NUNCA sobrescreve um plano que o dono ja editou pela tela Admin -> Planos: a condicao
--    priceCents = 0 AND active = false so bate no estado "recem-criado, nao precificado" --
--    qualquer preco diferente de 0 (mesmo que ainda active=false) e deixado intocado.

INSERT INTO "plans" (id, code, name, "priceCents", "maxWhatsappNumbers", "maxProfessionals", active, "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || v.code), v.code, v.name, v."priceCents", v."maxWhatsappNumbers", v."maxProfessionals", true, v."sortOrder", now(), now()
FROM (
  VALUES
    ('essencial', 'Essencial', 5990, 1, 3, 1),
    ('profissional', 'Profissional', 10990, 2, 10, 2),
    ('clinica', 'Clinica', 18990, 3, NULL::int, 3)
) AS v(code, name, "priceCents", "maxWhatsappNumbers", "maxProfessionals", "sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM "plans" p WHERE p.code = v.code);

UPDATE "plans"
SET "priceCents" = v."priceCents", active = true
FROM (
  VALUES
    ('essencial', 5990),
    ('profissional', 10990),
    ('clinica', 18990)
) AS v(code, "priceCents")
WHERE "plans".code = v.code
  AND "plans"."priceCents" = 0
  AND "plans".active = false;
