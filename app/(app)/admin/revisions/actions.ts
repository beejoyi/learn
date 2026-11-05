"use server";

import { adminContext } from "@/admin/action";
import { restoreRevisionChecked, type Result } from "@/admin/service";

/** Re-applies a stored snapshot if it still fits the editors' rules; the restore itself becomes a new revision. */
export async function restoreRevisionAction(
  revisionId: string,
): Promise<Result> {
  const user = await adminContext();
  return restoreRevisionChecked(String(revisionId), user.email);
}
