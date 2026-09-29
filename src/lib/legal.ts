/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade — fonte única.
 *
 * `TERMS_VERSION` é enviada pelo formulário de cadastro e gravada pelo backend em
 * `termsVersion` (aceite versionado, docs/arquitetura.md §7.3 e §11). As páginas `/termos` e
 * `/privacidade` exibem o mesmo valor. Ao publicar uma nova redação:
 *   1. atualize o texto em `src/app/(public)/termos/termos-content.ts` e/ou
 *      `src/app/(public)/privacidade/privacidade-content.ts`;
 *   2. atualize o Markdown espelho em `docs/legal/`;
 *   3. troque `TERMS_VERSION` e `LEGAL_EFFECTIVE_DATE` aqui.
 *
 * Formato da versão: data ISO (`AAAA-MM-DD`) do dia em que a redação entra em vigor.
 */
export const TERMS_VERSION = "2026-09-28";

/** Data de vigência por extenso, para exibição. Mantenha em sincronia com `TERMS_VERSION`. */
export const LEGAL_EFFECTIVE_DATE = "28 de setembro de 2026";

/** Aviso exibido no topo das duas páginas enquanto o texto não passa por revisão jurídica. */
export const LEGAL_DRAFT_NOTICE =
  "Documento-modelo elaborado para o InnoChat; recomenda-se revisão por advogado antes da publicação definitiva.";
