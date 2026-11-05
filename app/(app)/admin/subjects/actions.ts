"use server";

import { adminContext } from "@/admin/action";
import { saveSubject, type Result, type SubjectInput } from "@/admin/service";

export async function saveSubjectAction(input: SubjectInput): Promise<Result> {
  const user = await adminContext();
  return saveSubject(input, user.email);
}
