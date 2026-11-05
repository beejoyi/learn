import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { AiError } from "@/lib/openrouter";
import { Question } from "@/models";
import { createSession } from "@/progress/quiz";
import { askFollowUp, consumeAiCall, gradeAnswer, loadCoachCard, parseFeedback } from "@/progress/quizAi";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedQuestions } from "./seed";

const FEEDBACK = {
  verdict: "partial",
  score: 62,
  summary: "Right idea, thin on detail.",
  strengths: ["Mentions scope"],
  missing: ["Lexical environment", "Example"],
  followUp: "What does a closure capture: values or variables?",
};

const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

async function setup() {
  const user = newUserId();
  const bookId = await seedBook("js");
  const [questionId] = await seedQuestions(bookId, 1);
  const created = await createSession(user, { bookIds: [], partKeys: [], mode: "all", size: null });
  if (!("sessionId" in created)) throw new Error("expected a session");
  return { user, bookId, questionId, sessionId: created.sessionId };
}

describe("parseFeedback", () => {
  it("parses JSON, clamps the score and suggests a mark from the verdict", () => {
    expect(parseFeedback(JSON.stringify(FEEDBACK))).toMatchObject({ verdict: "partial", score: 62, suggested: "review" });
    expect(parseFeedback(JSON.stringify({ ...FEEDBACK, verdict: "correct", score: 140 }))).toMatchObject({
      score: 100,
      suggested: "got",
    });
  });

  it("tolerates fences, missing lists and a missing score", () => {
    const parsed = parseFeedback("```json\n" + JSON.stringify({ verdict: "incorrect", summary: "No." }) + "\n```");
    expect(parsed).toEqual({
      verdict: "incorrect",
      score: 10,
      summary: "No.",
      strengths: [],
      missing: [],
      followUp: "",
      suggested: "review",
    });
  });

  it("rejects replies without a verdict or summary", () => {
    expect(parseFeedback("I think it is fine")).toBeNull();
    expect(parseFeedback(JSON.stringify({ verdict: "great", summary: "x" }))).toBeNull();
    expect(parseFeedback(JSON.stringify({ verdict: "correct" }))).toBeNull();
  });
});

describe("quiz coach", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "3");
    resetEnvCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("loads only visible cards from the user's own session", async () => {
    const { user, sessionId, questionId, bookId } = await setup();
    expect(await loadCoachCard(user, sessionId, questionId)).toEqual({
      question: "p1 question 0",
      prompt: "prompt 0",
      answer: "answer 0",
    });
    expect(await loadCoachCard(newUserId(), sessionId, questionId)).toBeNull();
    const [other] = await seedQuestions(bookId, 1, "p2");
    expect(await loadCoachCard(user, sessionId, other)).toBeNull();
    expect(await loadCoachCard(user, "bad", questionId)).toBeNull();
    await Question.updateOne({ _id: questionId }, { status: "draft" });
    expect(await loadCoachCard(user, sessionId, questionId)).toBeNull();
  });

  it("grades an answer, sending the question, reference and learner answer", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn(async () => reply(JSON.stringify(FEEDBACK)));
    const feedback = await gradeAnswer(user, sessionId, questionId, "It keeps scope", { fetch });
    expect(feedback).toMatchObject({ verdict: "partial", score: 62, suggested: "review", followUp: FEEDBACK.followUp });

    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const userMessage = body.messages.at(-1).content as string;
    expect(userMessage).toContain("<question>\np1 question 0");
    expect(userMessage).toContain("<reference_answer>\nanswer 0");
    expect(userMessage).toContain("<learner_answer>\nIt keeps scope");
  });

  it("refuses blank answers and foreign sessions without calling the model", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn();
    await expect(gradeAnswer(user, sessionId, questionId, "  ", { fetch })).rejects.toThrow(/Type an answer/);
    await expect(gradeAnswer(newUserId(), sessionId, questionId, "x", { fetch })).rejects.toThrow(/no longer available/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports an unreadable reply", async () => {
    const { user, sessionId, questionId } = await setup();
    await expect(gradeAnswer(user, sessionId, questionId, "x", { fetch: async () => reply("hmm") })).rejects.toThrow(
      /unreadable/,
    );
  });

  it("enforces the daily limit per user and resets the next day", async () => {
    const user = newUserId();
    const day = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 3; i++) await consumeAiCall(user, day);
    await expect(consumeAiCall(user, day)).rejects.toThrow(AiError);
    await consumeAiCall(newUserId(), day);
    await consumeAiCall(user, new Date("2026-01-02T00:00:01Z"));
  });

  it("does not limit when the limit is 0", async () => {
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "0");
    resetEnvCache();
    const user = newUserId();
    for (let i = 0; i < 5; i++) await consumeAiCall(user);
  });

  it("answers a follow-up with the conversation after the card context", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn(async () => reply("Variables, by reference."));
    const history = [
      { role: "assistant" as const, content: "Values or variables?" },
      { role: "user" as const, content: "Values?" },
    ];
    expect(await askFollowUp(user, sessionId, questionId, history, "my answer", { fetch })).toBe("Variables, by reference.");
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("<reference_answer>\nanswer 0");
    expect(body.messages[0].content).toContain("<learner_answer>\nmy answer");
    expect(body.messages.slice(1)).toEqual(history);
  });

  it("requires the learner to speak last in a follow-up", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn();
    await expect(
      askFollowUp(user, sessionId, questionId, [{ role: "assistant", content: "Hi" }], "", { fetch }),
    ).rejects.toThrow(/Type a message/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
