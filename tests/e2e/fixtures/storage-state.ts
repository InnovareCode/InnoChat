/**
 * Caminhos dos `storageState` (cookie de sessão já autenticado) gerados UMA vez por
 * `global-setup.ts` — evita que dezenas de specs façam login de verdade pela UI repetidamente
 * para o MESMO usuário, o que estourava o rate limit de login (8 tentativas/15min por e-mail,
 * `src/modules/auth/service.ts`) ao rodar a suíte inteira (ver
 * `.claude/agent-memory/iris/login_rate_limit_e2e.md`).
 *
 * Specs consomem via `test.use({ storageState: OWNER_STORAGE_STATE })` (nível de arquivo ou de
 * `describe`) em vez de chamar `login()`/`loginAndWaitForPanel()` a cada teste. Specs que testam
 * o LOGIN em si (`auth.spec.ts`, e o teste "login: sem violação de CSP" de `csp.spec.ts`) continuam
 * logando de verdade pela UI — é a própria tela sob teste.
 *
 * Arquivos gitignored (`tests/e2e/.auth/`) — contêm cookie de sessão válido, recriados a cada run
 * pelo `global-setup.ts` e apagados pelo `global-teardown.ts`.
 */
export const AUTH_DIR = "./tests/e2e/.auth";

export const OWNER_STORAGE_STATE = `${AUTH_DIR}/owner.json`;
export const STAFF_STORAGE_STATE = `${AUTH_DIR}/staff.json`;
export const TENANT_B_OWNER_STORAGE_STATE = `${AUTH_DIR}/tenant-b-owner.json`;
