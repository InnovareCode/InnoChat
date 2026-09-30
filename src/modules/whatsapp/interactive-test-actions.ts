"use server";

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/errors";
import { runAction, type Result } from "@/lib/result";
import {
  listTestableInstances,
  sendInteractiveTest,
  type InteractiveTestResult,
  type TestableInstance,
} from "./interactive-test";

/** Server Actions do teste de botões/lista/enquete (Admin → Saúde). Só admin da plataforma. */

const TEST_LIMIT = 10;
const TEST_WINDOW_MS = 60_000;

export async function listInteractiveTestInstancesAction(): Promise<Result<TestableInstance[]>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    return listTestableInstances();
  });
}

export async function sendInteractiveTestAction(input: unknown): Promise<Result<InteractiveTestResult>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const rate = checkRateLimit(`interactive-test:${admin.id}`, TEST_LIMIT, TEST_WINDOW_MS);
    if (!rate.allowed) {
      throw new DomainError("RATE_LIMITED", "Muitos envios de teste. Aguarde um minuto.", { retryAfterMs: rate.retryAfterMs });
    }
    return sendInteractiveTest(input);
  });
}
