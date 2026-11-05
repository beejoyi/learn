"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/lib/ai-limits";
import {
  type AiSettingsInput,
  type SaveKeyResult,
  clearAiKey,
  getAiConfig,
  saveAiKey,
  saveAiSettings,
} from "@/lib/aiSettings";
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

/** Saves an OpenRouter key (encrypted); it is never sent back to the browser. */
export async function saveAiKeyAction(key: string): Promise<SaveKeyResult> {
  const user = await requireAdmin();
  await connectDb();
  const result = await saveAiKey(typeof key === "string" ? key : "", user.userId);
  if (result.ok) revalidatePath("/admin/ai");
  return result;
}

export async function clearAiKeyAction(): Promise<void> {
  const user = await requireAdmin();
  await connectDb();
  await clearAiKey(user.userId);
  revalidatePath("/admin/ai");
}

/** Sends a tiny prompt to each model so the admin sees which ones answer right now. */
export async function testAiModelsAction(models: string[]): Promise<ModelCheck[]> {
  await requireAdmin();
  const ids = z
    .array(z.string().trim().max(MODEL_ID_MAX).regex(MODEL_ID_PATTERN))
    .min(1)
    .max(2)
    .parse(models);
  await connectDb();
  const { apiKey } = await getAiConfig();
  return checkModels(ids, { apiKey });
}
