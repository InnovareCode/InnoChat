// Cria o banco dedicado do simulador se não existir (conecta no banco `postgres` do mesmo servidor).
// Uso: node scripts/bot-sim/create-db.mjs   (depois: withdb.mjs npx prisma migrate deploy)
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
const name = process.env.BOTSIM_DB || "innochat_botsim";
if (!/^[a-z0-9_]+$/.test(name)) throw new Error("nome de banco inválido");
const admin = new URL(m[1]);
admin.pathname = "/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
const rows = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_database WHERE datname = '${name}'`);
if (rows.length) console.log(`banco ${name} já existe`);
else { await prisma.$executeRawUnsafe(`CREATE DATABASE ${name}`); console.log(`banco ${name} criado`); }
await prisma.$disconnect();
