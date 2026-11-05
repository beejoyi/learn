import { requireAdmin, type SessionUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";

/**
 * The start of every admin Server Action: checks the caller is an admin (throws ForbiddenError
 * otherwise, before any input is read) and connects to the database.
 */
export async function adminContext(): Promise<SessionUser> {
  const user = await requireAdmin();
  await connectDb();
  return user;
}
