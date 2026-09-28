-- Migration escrita à mão (Prisma não expressa EXCLUDE no schema.prisma).
--
-- Garante, no próprio banco, que nenhum profissional tenha dois agendamentos SCHEDULED com
-- intervalos [startsAt, blockEndsAt) sobrepostos. É a última linha de defesa contra double
-- booking (docs/arquitetura.md §2 regra 3, §12 risco 13) — a aplicação também valida antes de
-- inserir, mas a garantia de verdade é esta constraint sob concorrência real.
--
-- Reversível: ver DOWN.sql neste mesmo diretório (remove a constraint e a extensão).

-- btree_gist é necessário para usar "=" (igualdade) sobre professionalId (texto) dentro de um
-- índice GiST, combinado com "&&" (overlap) sobre o tstzrange.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap_per_professional"
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tstzrange("startsAt", "blockEndsAt", '[)') WITH &&
  )
  WHERE (status = 'SCHEDULED');
