import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes condicionais e resolve conflitos do Tailwind (última
 * classe conflitante vence). Vive em `src/components/lib`, não em
 * `src/lib` — este projeto divide `src/lib` para a Vega (backend/domínio);
 * tudo que é puramente de UI fica sob `src/components/`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
