-- Revogação de sessão JWT (User.sessionVersion). Aditiva: coluna NOT NULL com default,
-- compatível com o código antigo rodando durante o deploy (ele simplesmente não a lê).
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
