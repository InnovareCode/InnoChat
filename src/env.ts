import { z } from "zod";

/**
 * Validação de env em um único lugar, na borda do processo — nunca confie em
 * `process.env.X!` disperso pelo código. Falha rápido e com mensagem clara no
 * boot se faltar algo, em vez de um erro obscuro em produção horas depois.
 *
 * Segredos de integração (Evolution, n8n, Mercado Pago, e-mail) NÃO entram
 * aqui: moram em `PlatformSettings` no banco, mascarados na UI (ver
 * docs/arquitetura.md §14 — "Credenciais da plataforma no banco... Nada em
 * env var"). Este arquivo só valida o que é infraestrutura do próprio
 * processo (banco, auth, URL pública).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL precisa ser uma connection string do Postgres",
    }),

  // Auth.js v5. Gere com: npx auth secret
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET precisa ter pelo menos 16 caracteres"),
  AUTH_URL: z.string().url("AUTH_URL precisa ser uma URL válida"),

  // Único domínio público do painel (arquitetura.md §14: "AUTH_URL /
  // NEXT_PUBLIC_APP_URL com um domínio").
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL precisa ser uma URL válida"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
