import { z } from "zod";
import { MODEL_ID_MAX, MODEL_ID_PATTERN } from "@/lib/ai-limits";
import { getEnv } from "@/lib/env";
import { AiSettings } from "@/models";

export type AiSettingsView = {
  /** OPENROUTER_API_KEY is set (it can only be set in the environment). */
  keyConfigured: boolean;
  /** The admin switch. */
  enabled: boolean;
  /** The coach is offered to learners: a key is set and the admin switch is on. */
  active: boolean;
  primaryModel: string;
  /** "" for none. */
  fallbackModel: string;
  /** Calls per user per UTC day; 0 means no limit. */
  dailyLimit: number;
};

type Row = { enabled?: boolean; primaryModel?: string; fallbackModel?: string; dailyLimit?: number };

/** The settings in effect: the admin's choices over the environment defaults. */
export async function getAiSettings(): Promise<AiSettingsView> {
  const env = getEnv();
  const row = await AiSettings.findById("ai").lean<Row>();
  const keyConfigured = Boolean(env.OPENROUTER_API_KEY);
  const enabled = row?.enabled ?? true;
  const primaryModel = row?.primaryModel || env.OPENROUTER_MODEL;
  return {
    keyConfigured,
    enabled,
    active: keyConfigured && enabled,
    primaryModel,
    fallbackModel: row?.fallbackModel && row.fallbackModel !== primaryModel ? row.fallbackModel : "",
    dailyLimit: row?.dailyLimit ?? env.OPENROUTER_DAILY_LIMIT,
  };
}

/** Models to try, in order. */
export const modelChain = (s: Pick<AiSettingsView, "primaryModel" | "fallbackModel">) =>
  [s.primaryModel, s.fallbackModel].filter(Boolean);

const modelId = z
  .string()
  .trim()
  .max(MODEL_ID_MAX, "Model id is too long")
  .regex(MODEL_ID_PATTERN, "Use an OpenRouter model id such as vendor/model:free");

export const aiSettingsInput = z
  .object({
    enabled: z.boolean(),
    primaryModel: modelId,
    fallbackModel: z.union([z.literal(""), modelId]),
    dailyLimit: z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0).max(100_000),
  })
  .refine((s) => s.fallbackModel !== s.primaryModel, {
    path: ["fallbackModel"],
    message: "Pick a different model than the primary one",
  });

export type AiSettingsInput = z.input<typeof aiSettingsInput>;

export async function saveAiSettings(
  input: AiSettingsInput,
  userId: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const parsed = aiSettingsInput.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
    return { ok: false, errors };
  }
  await AiSettings.updateOne({ _id: "ai" }, { $set: { ...parsed.data, updatedBy: userId } }, { upsert: true });
  return { ok: true };
}
