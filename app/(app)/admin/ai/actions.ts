"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/lib/ai-limits";
import { type AiSettingsInput, saveAiSettings } from "@/lib/aiSettings";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { type ModelCheck, checkModels } from "@/lib/openrouter";

export async function saveAiSettingsAction(
  input: AiSettingsInput,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const user = await requireAdmin();
  await connectDb();
  const result = await saveAiSettings(input, user.userId);
  if (result.ok) revalidatePath("/admin/ai");
  return result;
}

/** Sends a tiny prompt to each model so the admin sees which ones answer right now. */
export async function testAiModelsAction(models: string[]): Promise<ModelCheck[]> {
  await requireAdmin();
  const ids = z
    .array(z.string().trim().max(MODEL_ID_MAX).regex(MODEL_ID_PATTERN))
    .min(1)
    .max(2)
    .parse(models);
  return checkModels(ids);
}
