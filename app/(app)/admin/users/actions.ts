"use server";

import { adminContext } from "@/admin/action";
import type { Result } from "@/admin/service";
import { setUserAccess } from "@/admin/users";

export async function setUserAccessAction(
  id: string,
  status: "approved" | "blocked",
  reason?: string,
): Promise<Result> {
  const admin = await adminContext();
  return setUserAccess({ id, status, reason }, admin.email);
}
