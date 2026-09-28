# syntax=docker/dockerfile:1

# InnoChat — imagem única do serviço `innochat-painel` (Next.js standalone,
# porta 3000). Um processo serve painel, API interna (n8n) e webhook do
# Mercado Pago — ver docs/arquitetura.md §1.
#
# Build local/CI:
#   docker build -t innochat-painel -f Dockerfile .
#
# IMPORTANTE — migration NÃO roda aqui dentro (nem no entrypoint, nem no
# CMD). `npm run db:migrate` (prisma migrate deploy) é um passo separado,
# disparado ANTES de subir a nova versão da imagem. Motivo (lição do
# InnoAtendente, docs/arquitetura.md §14): se a migration entrasse no boot,
# várias réplicas subindo juntas rodariam a migration em paralelo, e um
# rollback de imagem não desfaria uma migration que já rodou com a versão
# anterior.
#
# Prisma + Alpine (musl): a imagem final roda em node:22-alpine (musl libc),
# não Debian. `prisma/schema.prisma` precisa declarar
# `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` (Cronos) — senão
# `prisma generate` só baixa o engine da máquina de build e o container falha
# em runtime com "Query Engine binary not found".

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

USER node
EXPOSE 3000

# server.js é o entrypoint gerado pelo Next standalone. Sem `npm run start`:
# evita o processo intermediário do npm e deixa o Node receber SIGTERM direto
# do orquestrador (Easypanel) para desligar de forma graciosa.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
