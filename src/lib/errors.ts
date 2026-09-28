/**
 * Erro de domínio: representa uma condição ESPERADA (regra de negócio, validação,
 * permissão) — nunca um bug ou falha de infraestrutura. `runAction` (src/lib/result.ts)
 * converte instâncias disto em `Result<T>` com o `code` certo; qualquer outro erro
 * propaga e vira a tela de erro do Next (docs/contratos.md, convenção de Result<T>).
 */
export class DomainError extends Error {
  readonly code: string;
  /** Dados extra para o cliente tratar programaticamente (ex.: alternativas de SLOT_TAKEN). */
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
