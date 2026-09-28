import { ZodError } from "zod";
import { DomainError, isDomainError } from "./errors";

/**
 * Convenção de retorno das Server Actions (docs/contratos.md): nunca lançam para erro
 * esperado (validação, regra de negócio, permissão) — devolvem `Result<T>`. Erros
 * inesperados (bug, banco fora do ar) propagam e viram a tela de erro do Next.
 */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, details?: unknown): Result<never> {
  return { ok: false, error: { code, message, details } };
}

/**
 * Executa a lógica de uma Server Action e converte `DomainError`/`ZodError` (erros
 * esperados) em `Result` de falha. Qualquer outro erro (bug, conexão com o banco caiu,
 * etc.) é relançado — não vira `Result`, propaga para a Error Boundary do Next.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    if (isDomainError(error)) {
      return err(error.code, error.message, error.details);
    }
    if (error instanceof ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`).join("; ");
      return err("INVALID_PAYLOAD", message || "Dados inválidos.");
    }
    throw error;
  }
}

export { DomainError };
