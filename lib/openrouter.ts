import { getEnv } from "@/lib/env";

export const OPENROUTER_API = "https://openrouter.ai/api/v1";
export const OPENROUTER_URL = `${OPENROUTER_API}/chat/completions`;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** A failure the learner may see as is; details stay in the server log. */
export class AiError extends Error {}

export type ChatOptions = {
  /** Tried in order: a model that fails, or whose reply `accept` rejects, falls through to the next. */
  models: string[];
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object matching this schema (models that ignore it are still parsed leniently). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Rejects an unusable reply (e.g. JSON that does not parse), so the next model is tried. */
  accept?: (text: string) => boolean;
  /** Per model attempt. */
  timeoutMs?: number;
  /** Injected in tests. */
  fetch?: typeof fetch;
};

export type ChatReply = { text: string; model: string };

/** Why one model attempt failed; `final` stops the fallback (another model cannot fix it). */
class AttemptError extends Error {
  constructor(
    message: string,
    readonly final = false,
  ) {
    super(message);
  }
}

async function attempt(model: string, messages: ChatMessage[], options: ChatOptions, key: string): Promise<string> {
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens ?? 800,
    temperature: options.temperature ?? 0.2,
    ...(options.jsonSchema
      ? { response_format: { type: "json_schema", json_schema: { ...options.jsonSchema, strict: true } } }
      : {}),
  };

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Learn" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
    });
  } catch (error) {
    console.error(`OpenRouter request to ${model} failed`, error);
    throw new AttemptError("The AI coach could not be reached. Try again.");
  }

  if (!response.ok) {
    console.error(`OpenRouter error from ${model}`, response.status, await response.text().catch(() => ""));
    if (response.status === 401) throw new AttemptError("The AI coach is misconfigured (the OpenRouter key was rejected).", true);
    throw new AttemptError(
      response.status === 429 ? "The AI coach is busy right now. Try again shortly." : "The AI coach failed. Try again.",
    );
  }

  const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error(`OpenRouter returned no content from ${model}`, JSON.stringify(data)?.slice(0, 500));
    throw new AttemptError("The AI coach returned an empty reply. Try again.");
  }
  const text = content.trim();
  if (options.accept && !options.accept(text)) {
    console.error(`Unusable reply from ${model}`, text.slice(0, 500));
    throw new AttemptError("The AI coach gave an unreadable reply. Try again.");
  }
  return text;
}

/** One chat completion through OpenRouter, falling back through `options.models` in order. */
export async function chatCompletion(messages: ChatMessage[], options: ChatOptions): Promise<ChatReply> {
  const key = getEnv().OPENROUTER_API_KEY;
  if (!key) throw new AiError("The AI coach is not configured.");
  const models = [...new Set(options.models.filter(Boolean))];
  if (!models.length) throw new AiError("No AI model is selected.");

  let last: AttemptError | undefined;
  for (const model of models) {
    try {
      return { text: await attempt(model, messages, options, key), model };
    } catch (error) {
      if (!(error instanceof AttemptError)) throw error;
      last = error;
      if (error.final) break;
    }
  }
  throw new AiError(last?.message ?? "The AI coach failed. Try again.");
}

/** The first JSON object in a reply, tolerating code fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export type CatalogModel = {
  id: string;
  name: string;
  free: boolean;
  contextLength: number | null;
};

const CATALOG_TTL_MS = 10 * 60 * 1000;
let catalogCache: { at: number; models: CatalogModel[] } | undefined;

/** Testing hook. */
export const resetCatalogCache = () => {
  catalogCache = undefined;
};

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  architecture?: { output_modalities?: unknown };
};

const isZero = (price: unknown) => typeof price === "string" && Number(price) === 0 && price.trim() !== "";

/** Text models from a /models response, free ones first, then by name. */
export function parseCatalog(data: unknown): CatalogModel[] {
  const rows = (data as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  return (rows as RawModel[])
    .filter((m): m is RawModel & { id: string } => typeof m.id === "string" && Boolean(m.id))
    .filter((m) => {
      const out = m.architecture?.output_modalities;
      return !Array.isArray(out) || out.includes("text");
    })
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" && m.name ? m.name : m.id,
      free: m.id.endsWith(":free") || (isZero(m.pricing?.prompt) && isZero(m.pricing?.completion)),
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
    }))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
}

/** OpenRouter's model catalogue, cached for a few minutes; an empty list with an error when it cannot be read. */
export async function listCatalog(
  options: { fetch?: typeof fetch; now?: number } = {},
): Promise<{ models: CatalogModel[]; error?: string }> {
  const now = options.now ?? Date.now();
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return { models: catalogCache.models };
  try {
    const key = getEnv().OPENROUTER_API_KEY;
    const response = await (options.fetch ?? fetch)(`${OPENROUTER_API}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const models = parseCatalog(await response.json());
    if (!models.length) throw new Error("empty model list");
    catalogCache = { at: now, models };
    return { models };
  } catch (error) {
    console.error("Could not load the OpenRouter model list", error);
    return { models: [], error: "Could not load OpenRouter's model list. You can still type a model id." };
  }
}

export type ModelCheck = { model: string; ok: boolean; ms: number; error?: string };

/** Asks each model for a one-word reply, one at a time (no fallback), and reports how it went. */
export async function checkModels(models: string[], options: { fetch?: typeof fetch } = {}): Promise<ModelCheck[]> {
  const results: ModelCheck[] = [];
  for (const model of models) {
    const started = Date.now();
    try {
      await chatCompletion([{ role: "user", content: "Reply with the single word OK." }], {
        ...options,
        models: [model],
        maxTokens: 50,
        timeoutMs: 20_000,
      });
      results.push({ model, ok: true, ms: Date.now() - started });
    } catch (error) {
      results.push({
        model,
        ok: false,
        ms: Date.now() - started,
        error: error instanceof AiError ? error.message : "Failed",
      });
    }
  }
  return results;
}
