import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPENROUTER_MODEL, resetEnvCache } from "@/lib/env";
import { AiError, OPENROUTER_URL, aiEnabled, chatCompletion, extractJson } from "@/lib/openrouter";

const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

describe("openrouter", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    resetEnvCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });

  it("is enabled only with a key", () => {
    expect(aiEnabled()).toBe(true);
    vi.stubEnv("OPENROUTER_API_KEY", " ");
    resetEnvCache();
    expect(aiEnabled()).toBe(false);
  });

  it("posts the messages with the key and default model and returns the reply text", async () => {
    const fetch = vi.fn(async () => reply("  hello  "));
    const text = await chatCompletion([{ role: "user", content: "hi" }], {
      fetch,
      jsonSchema: { name: "x", schema: { type: "object" } },
    });
    expect(text).toBe("hello");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.response_format.json_schema.name).toBe("x");
  });

  it("uses OPENROUTER_MODEL when set", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/some-model");
    resetEnvCache();
    const fetch = vi.fn(async () => reply("ok"));
    await chatCompletion([{ role: "user", content: "hi" }], { fetch });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body)).model).toBe("anthropic/some-model");
  });

  it("turns HTTP errors, network errors and empty replies into AiError", async () => {
    const msg = [{ role: "user" as const, content: "hi" }];
    await expect(chatCompletion(msg, { fetch: async () => new Response("nope", { status: 500 }) })).rejects.toThrow(AiError);
    await expect(chatCompletion(msg, { fetch: async () => new Response("", { status: 429 }) })).rejects.toThrow(/busy/);
    await expect(
      chatCompletion(msg, {
        fetch: async () => {
          throw new TypeError("network");
        },
      }),
    ).rejects.toThrow(/could not be reached/);
    await expect(chatCompletion(msg, { fetch: async () => reply("") })).rejects.toThrow(/empty/);
    await expect(chatCompletion(msg, { fetch: async () => reply(null) })).rejects.toThrow(/empty/);
  });

  it("refuses to call without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    resetEnvCache();
    const fetch = vi.fn();
    await expect(chatCompletion([{ role: "user", content: "hi" }], { fetch })).rejects.toThrow(/not configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("extractJson finds the object inside fences or prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(extractJson("no json")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });
});
