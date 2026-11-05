"use server";

import { z } from "zod";
import { adminContext } from "@/admin/action";
import { type ActionResult, ok } from "@/admin/result";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/lib/ai-limits";
import { type AiSettingsInput, clearAiKey, getAiConfig, saveAiKey, saveAiSettings } from "@/lib/aiSettings";
import { type KeyCheck, type ModelCheck, checkModels } from "@/lib/openrouter";

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<ActionResult> {
  const user = await adminContext();
  return saveAiSettings(input, user.userId);
}

/** Saves an OpenRouter key (encrypted); it is never sent back to the browser. */
export async function saveAiKeyAction(
  key: string,
): Promise<ActionResult<{ verified: Exclude<KeyCheck, { status: "rejected" }> }>> {
  const user = await adminContext();
  return saveAiKey(typeof key === "string" ? key : "", user.userId);
}

export async function clearAiKeyAction(): Promise<ActionResult> {
  const user = await adminContext();
  await clearAiKey(user.userId);
  return ok();
}

/** A lookup, not an update: sends a tiny prompt to each model so the admin sees which ones answer. */
export async function testAiModelsAction(models: string[]): Promise<ModelCheck[]> {
  await adminContext();
  const ids = z
    .array(z.string().trim().max(MODEL_ID_MAX).regex(MODEL_ID_PATTERN))
    .min(1)
    .max(2)
    .parse(models);
  const { apiKey } = await getAiConfig();
  return checkModels(ids, { apiKey });
}
