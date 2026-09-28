-- Rollback manual (Prisma não roda DOWN automaticamente; ver PARA O PRÓXIMO no handoff sobre como
-- é o procedimento de rollback deste projeto).
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_no_overlap_per_professional";
-- Não faz DROP EXTENSION btree_gist aqui de propósito: outra migration/feature pode passar a
-- depender dela. Remover a extensão é decisão manual, não automática de rollback.
