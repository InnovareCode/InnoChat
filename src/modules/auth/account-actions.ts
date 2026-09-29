"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { userNameSchema } from "@/lib/validation/user-name";
import { getAccount, updateAccountName, type MyAccount } from "./account";

export type { MyAccount };

/** Dados do próprio usuário logado (perfil). */
export async function getMyAccountAction(): Promise<Result<MyAccount>> {
  return runAction(async () => {
    const user = await requireSessionUser();
    return getAccount(user.id);
  });
}

const updateSchema = z.object({ name: userNameSchema });

/** Qualquer usuário logado altera SÓ o próprio nome — o id vem da sessão. */
export async function updateMyAccountAction(input: unknown): Promise<Result<MyAccount>> {
  return runAction(async () => {
    const user = await requireSessionUser();
    const data = updateSchema.parse(input);
    return updateAccountName(user.id, data.name);
  });
}
