import { getEnv } from "@/lib/env";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** A failure the learner may see as is; details stay in the server log. */
export class AiError extends Error {}

export type ChatOptions = {
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object matching this schema (models that ignore it are still parsed leniently). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  timeoutMs?: number;
  /** Injected in tests. */
  fetch?: typeof fetch;
};

export const aiEnabled = () => Boolean(getEnv().OPENROUTER_API_KEY);

/** One chat completion through OpenRouter's OpenAI-compatible API; resolves with the reply text. */
export async function chatCompletion(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = getEnv();
  if (!OPENROUTER_API_KEY) throw new AiError("The AI coach is not configured.");

  const body = {
    model: OPENROUTER_MODEL,
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
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Learn",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch (error) {
    console.error("OpenRouter request failed", error);
    throw new AiError("The AI coach could not be reached. Try again.");
  }

  if (!response.ok) {
    console.error("OpenRouter error", response.status, await response.text().catch(() => ""));
    throw new AiError(
      response.status === 429 ? "The AI coach is busy right now. Try again shortly." : "The AI coach failed. Try again.",
    );
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("OpenRouter returned no content", JSON.stringify(data)?.slice(0, 500));
    throw new AiError("The AI coach returned an empty reply. Try again.");
  }
  return content.trim();
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
