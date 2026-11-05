import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import {
  AiError,
  OPENROUTER_URL,
  chatCompletion,
  checkModels,
  extractJson,
  listCatalog,
  parseCatalog,
  resetCatalogCache,
} from "@/lib/openrouter";

const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
const sentModel = (fetch: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse(String((fetch.mock.calls[call] as unknown as [string, RequestInit])[1].body)).model;
const msg = [{ role: "user" as const, content: "hi" }];

describe("openrouter", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    resetEnvCache();
    resetCatalogCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });

  it("posts the messages with the key and returns the reply text and model", async () => {
    const fetch = vi.fn(async () => reply("  hello  "));
    const result = await chatCompletion(msg, {
      models: ["a/one:free"],
      fetch,
      jsonSchema: { name: "x", schema: { type: "object" } },
    });
    expect(result).toEqual({ text: "hello", model: "a/one:free" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("a/one:free");
    expect(body.messages).toEqual(msg);
    expect(body.response_format.json_schema.name).toBe("x");
  });

  it("falls back to the next model on errors, empty and unaccepted replies", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(reply(""))
      .mockResolvedValueOnce(reply("not json"))
      .mockResolvedValueOnce(reply('{"ok":true}'));
    const result = await chatCompletion(msg, {
      models: ["a/1", "a/2", "a/3", "a/4"],
      fetch,
      accept: (t) => t.startsWith("{"),
    });
    expect(result).toEqual({ text: '{"ok":true}', model: "a/4" });
    expect([0, 1, 2, 3].map((i) => sentModel(fetch, i))).toEqual(["a/1", "a/2", "a/3", "a/4"]);
  });

  it("reports the last failure when every model fails", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(chatCompletion(msg, { models: ["a/1", "a/2"], fetch })).rejects.toThrow(/busy/);
    await expect(
      chatCompletion(msg, { models: ["a/1"], fetch: async () => new Response("x", { status: 500 }) }),
    ).rejects.toBeInstanceOf(AiError);
  });

  it("does not fall back when the key is rejected", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 401 }));
    await expect(chatCompletion(msg, { models: ["a/1", "a/2"], fetch })).rejects.toThrow(/key was rejected/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses to call without a key or without a model", async () => {
    const fetch = vi.fn();
    await expect(chatCompletion(msg, { models: [], fetch })).rejects.toThrow(/No AI model/);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    resetEnvCache();
    await expect(chatCompletion(msg, { models: ["a/1"], fetch })).rejects.toThrow(/not configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("extractJson finds the object inside fences or prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(extractJson("no json")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });

  describe("catalogue", () => {
    const raw = {
      data: [
        { id: "z/paid", name: "Zed Paid", context_length: 8000, pricing: { prompt: "0.000001", completion: "0.000002" } },
        { id: "b/model:free", name: "Bee Free", context_length: 131072, pricing: { prompt: "0", completion: "0" } },
        { id: "a/zero", name: "Ay Zero", pricing: { prompt: "0", completion: "0" } },
        { id: "i/image", name: "Image only", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["image"] } },
        { id: "openrouter/auto", name: "Auto", pricing: { prompt: "-1", completion: "-1" } },
        { name: "no id" },
      ],
    };

    it("lists text models with free ones first, sorted by name", () => {
      expect(parseCatalog(raw)).toEqual([
        { id: "a/zero", name: "Ay Zero", free: true, contextLength: null },
        { id: "b/model:free", name: "Bee Free", free: true, contextLength: 131072 },
        { id: "openrouter/auto", name: "Auto", free: false, contextLength: null },
        { id: "z/paid", name: "Zed Paid", free: false, contextLength: 8000 },
      ]);
      expect(parseCatalog(null)).toEqual([]);
    });

    it("caches the list and reports a failure without throwing", async () => {
      const fetch = vi.fn(async () => new Response(JSON.stringify(raw)));
      expect((await listCatalog({ fetch, now: 0 })).models).toHaveLength(4);
      await listCatalog({ fetch, now: 60_000 });
      expect(fetch).toHaveBeenCalledTimes(1);
      await listCatalog({ fetch, now: 11 * 60_000 });
      expect(fetch).toHaveBeenCalledTimes(2);

      resetCatalogCache();
      const failed = await listCatalog({ fetch: async () => new Response("", { status: 503 }) });
      expect(failed.models).toEqual([]);
      expect(failed.error).toMatch(/type a model id/);
    });
  });

  it("checkModels tries each model on its own and reports the outcome", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply("OK"))
      .mockResolvedValueOnce(new Response("", { status: 404 }));
    const results = await checkModels(["a/1", "a/2"], { fetch });
    expect(results.map(({ model, ok }) => ({ model, ok }))).toEqual([
      { model: "a/1", ok: true },
      { model: "a/2", ok: false },
    ]);
    expect(results[1].error).toMatch(/failed/);
  });
});
