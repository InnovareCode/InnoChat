---
name: migrate-diff-sem-tty
description: Como gerar e aplicar uma migration nova no InnoChat sem travar em prompt interativo (`prisma migrate dev` pede confirmação e não tem TTY nesta sessão)
metadata:
  type: project
---

`prisma migrate dev` pede confirmação interativa (nome da migration, "aplicar?") e trava
indefinidamente numa sessão sem TTY. O caminho usado neste projeto, e que deve se repetir em toda
migration nova:

1. Editar `prisma/schema.prisma` com o schema final desejado.
2. `npx prisma validate` — confere sintaxe antes de gastar tempo com o diff.
3. Gerar o SQL comparando o **banco real** (via datasource do schema, que lê `DATABASE_URL` do
   `.env`) contra o **schema editado**, sem precisar de shadow database:
   ```
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script > <scratchpad>/migration.sql
   ```
   (`--from-schema-datasource` introspecciona o banco ligado a esse `DATABASE_URL`; `--to-schema-datamodel` lê o arquivo. Como só há UMA fonte de verdade de schema no repo, os dois `--from`/`--to` apontam pro mesmo arquivo, mas em modos diferentes — não é redundante.)
4. Criar a pasta `prisma/migrations/<timestamp>_<nome>/` seguindo a numeração já usada
   (`20260928000001`, `000002`, `000003`, `000004`...) e colar o SQL ali (removendo as linhas de
   `warn` do Prisma que vêm no topo da saída).
5. Escrever também um `DOWN.sql` na mesma pasta (convenção deste projeto desde
   `0002_appointment_exclude_no_overlap`; Prisma não roda DOWN automaticamente, é só para quem for
   fazer rollback manual).
6. Aplicar com `npx prisma migrate deploy` (não interativo) — primeiro no banco de dev
   (`innochat`), depois no `innochat_test` (ver [[integration_tests_setup]] — Vega, no memory dela
   — para como derivar `TEST_DATABASE_URL` sem imprimir a senha do `.env`).
7. `npx prisma generate` pode falhar com `EPERM` no Windows se algum processo (dev server de
   outro agente rodando em paralelo) está com o `query_engine-windows.dll.node` aberto. Não é
   motivo para matar o processo de outro agente — só tentar de novo (2-3 vezes bastou nesta
   sessão).

**Por quê:** `migrate dev` também recria o shadow database e pode dar reset se detectar drift —
perigoso rodar sem controle numa sessão automatizada. O fluxo diff+deploy é determinístico, dá pra
revisar o SQL antes de aplicar, e não pede nada interativamente.
