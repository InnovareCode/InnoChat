import type { Page } from "@playwright/test";

/**
 * Coleta violações reais de CSP durante a navegação — tanto o evento DOM
 * `securitypolicyviolation` (mais confiável, dispara para toda diretiva bloqueada) quanto
 * mensagens de console que o Chromium também imprime ("Refused to ..."). Comece a escutar ANTES
 * de navegar (`page.goto`), senão perde violações que acontecem no load inicial.
 */
export function collectCspViolations(page: Page): { violations: string[] } {
  const violations: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (/content security policy|refused to/i.test(text)) {
      violations.push(text);
    }
  });

  // `addInitScript` roda antes de qualquer script da página, em toda navegação subsequente desta
  // `page` — garante que o listener já está de pé mesmo em recarregamentos.
  void page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      // eslint-disable-next-line no-console -- capturado pelo listener de console acima, de propósito.
      console.error(
        `Content-Security-Policy violation: directive="${e.violatedDirective}" blockedURI="${e.blockedURI}"`,
      );
    });
  });

  return { violations };
}
