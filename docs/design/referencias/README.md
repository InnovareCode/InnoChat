# Por que não há screenshots reais aqui

Tentativa de rodar as duas referências com Playwright, sem tocar em nenhum dos
dois projetos além de leitura:

- **ParquedasFeiras/frontend** (Vite + React Router): as telas dependem de
  `useAuthStore`/`useAdminDashboard` batendo em API real; não há mocks nem
  MSW no projeto (`src/mocks` não existe, `msw` não é dependência). Rodar
  `npm run dev` sem backend/DB daria só uma tela de login travada ou um erro
  de fetch — não serviria como referência visual.
- **MultMarkets/apps/web** (Next.js, monorepo Turborepo): o admin
  (`app/admin/layout.tsx`) é protegido por `AuthGuard requiredRole="ADMIN"` e
  depende da API NestJS (`apps/api`) + PostgreSQL + Redis rodando. Sem esse
  stack completo de pé, o resultado seria o mesmo problema — tela de login ou
  erro, não o layout renderizado de verdade.

Nos dois casos, subir o stack completo só para capturar print exigiria rodar
processos nesses dois projetos (que devo tratar como somente-leitura) sem
garantia de sucesso rápido (variáveis de ambiente, seed de dados, etc.) — o
custo/risco não se justificou para o que a extração por código já cobre com
números concretos (ver `../premium-spec.md`).

Toda a especificação em `../premium-spec.md` foi escrita citando o arquivo de
origem exato de cada valor (classe Tailwind, hex, token), para quem quiser
confirmar lendo o código-fonte diretamente.
