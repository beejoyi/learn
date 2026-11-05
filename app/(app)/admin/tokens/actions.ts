"use server";

import { adminContext } from "@/admin/action";
import { type ActionResult, fail, ok } from "@/admin/result";
import { createToken, revokeToken } from "@/admin/tokens";

/** Returns the new token once; only its hash is stored. */
export async function createTokenAction(name: string): Promise<ActionResult<{ token: string }>> {
  const user = await adminContext();
  const label = typeof name === "string" ? name.trim() : "";
  if (!label) return fail({ name: "Give the token a name" });
  const { token } = await createToken(label, user.userId);
  return ok({ token });
}

export async function revokeTokenAction(id: string): Promise<ActionResult> {
  await adminContext();
  await revokeToken(String(id));
  return ok();
}
