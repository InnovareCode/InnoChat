# syntax=docker/dockerfile:1

# InnoChat — imagem única do serviço `innochat-painel` (Next.js standalone,
# porta 3000). Um processo serve painel, API interna (n8n) e webhook do
# Mercado Pago — ver docs/arquitetura.md §1.
#
# Build local/CI:
#   docker build -t innochat-painel -f Dockerfile .
#
# IMPORTANTE — migration NÃO roda aqui dentro (nem no entrypoint, nem no
# CMD). `npx prisma migrate deploy` é um passo MANUAL, pelo Console do
# serviço no Easypanel, disparado ANTES do push que passa a depender do
# schema novo (docs/deploy-easypanel.md). Motivo (lição do InnoAtendente,
# docs/arquitetura.md §14): se a migration entrasse no boot, várias réplicas
# subindo juntas rodariam a migration em paralelo, e um rollback de imagem
# não desfaria uma migration que já rodou com a versão anterior. O runtime
# ganha a CLI do Prisma (abaixo) só para esse comando manual — não para rodar
# sozinho em nenhum momento do ciclo de vida do container.
#
# Prisma + Alpine (musl): build e runtime usam a MESMA imagem base
# (node:${NODE_VERSION}, alpine/musl) — `prisma generate` roda dentro do
# próprio container de build, então o engine "native" já resolve para
# linux-musl corretamente, sem precisar declarar `binaryTargets` explícito
# no schema. Se um dia builder e runtime usarem bases diferentes (ex.: build
# em Debian, runtime em Alpine), isso deixa de ser verdade e
# `prisma/schema.prisma` passa a precisar de
# `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` — sinalizado para
# o Cronos como risco a observar, não como bug atual.

ARG NODE_VERSION=22-alpine

# ---------------------------------------------------------------------------
# Stage: deps — instala TODAS as dependências (incl. dev: typescript, prisma
# cli) uma vez só.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage: builder — gera o Prisma Client e a build standalone do Next.js.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate ANTES do next build: o file tracing do Next só embala no
# standalone output o que já existe em node_modules/.prisma no momento do build.
RUN npm run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Stage: app — runtime do Next.js standalone, porta 3000, usuário não-root.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS app
WORKDIR /app
RUN apk add --no-cache openssl dumb-init
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next build com output:'standalone' já produz um node_modules mínimo com o
# tracing do Prisma Client incluso — não copiamos node_modules completo aqui.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Prisma CLI + migrations no runtime, só para `npx prisma migrate deploy` rodar pelo Console do
# Easypanel (docs/deploy-easypanel.md) — o node_modules do standalone acima é tracing de
# runtime do Next e NÃO inclui devDependencies (a CLI do Prisma é uma delas). `prisma/migrations`
# + `schema.prisma` também precisam estar no runtime — não fazem parte do output standalone (só
# código de aplicação).
#
# A instalação roda numa pasta ISOLADA (`npm install --prefix /tmp/prisma-cli`), não direto em
# /app: rodar `npm install <pkg>` com o package.json completo do projeto presente em /app, mas
# SEM package-lock.json nesta imagem, arrisca o npm tentar reconciliar TODAS as dependências
# declaradas contra o node_modules já podado do standalone — poderia reinstalar/alterar versões
# de pacotes que o Next rastreou com cuidado para o build (next, react, etc.). Instalando isolado
# e só copiando o resultado (`cp -R`) para dentro de /app/node_modules, a CLI do Prisma entra sem
# tocar em mais nada. `package.json` fica em /app só para `npm run db:migrate` funcionar como
# atalho de `npx prisma migrate deploy` pelo Console (mesmo script do package.json).
#
# NÃO VALIDADO por um `docker build` real nesta sessão (sem Docker disponível na máquina) — só
# raciocinado a partir do comportamento documentado do npm/Prisma. Testar no primeiro deploy real
# e, se `npx prisma migrate deploy` falhar no Console por binário ausente, investigar a partir daqui.
COPY --from=builder /app/prisma ./prisma
COPY package.json ./package.json
RUN PRISMA_VERSION=$(node -p "require('./package.json').devDependencies.prisma.replace(/^[^0-9]*/, '')") \
  && npm install --prefix /tmp/prisma-cli --no-save "prisma@${PRISMA_VERSION}" \
  && cp -R /tmp/prisma-cli/node_modules/. /app/node_modules/ \
  && rm -rf /tmp/prisma-cli \
  && chown -R node:node /app/node_modules /app/prisma /app/package.json

USER node
EXPOSE 3000

# GET /api/health faz um SELECT 1 leve no Postgres (src/app/api/health/route.ts) — prova que o
# processo está de pé E consegue falar com o banco, não só que a porta responde. Esta instrução
# HEALTHCHECK é o container reportando a própria saúde ao Docker/Swarm (o Easypanel roda sobre
# Docker Swarm); confirmar na aba de "Health Check" do serviço no Easypanel se há também um campo
# de UI para apontar `/api/health` explicitamente (docs/deploy-easypanel.md) — não assumir que o
# painel usa isto automaticamente sem checar a interface real (lição registrada: interfaces reais
# do Easypanel já divergiram do que parecia óbvio de fora).
# `wget` vem do busybox da imagem alpine (sem instalar nada extra); start-period dá tempo do
# Next.js standalone terminar de subir antes da primeira checagem contar como falha.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/health || exit 1

# server.js é o entrypoint gerado pelo Next standalone. Sem `npm run start`:
# evita o processo intermediário do npm e deixa o Node receber SIGTERM direto
# do orquestrador (Easypanel) para desligar de forma graciosa.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
