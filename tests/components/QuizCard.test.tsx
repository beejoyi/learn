// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type QuizCoach, QuizCard } from "@/components/QuizCard";
import type { SessionView } from "@/progress/quiz";

const card = {
  id: "q1",
  question: "What is a closure?",
  prompt: "",
  answer: "A function that keeps its scope.",
  bookSlug: "js",
  bookTitle: "JavaScript",
  partTitle: "Fundamentals",
};

const view = (over: Partial<SessionView> = {}): SessionView => ({
  sessionId: "s1",
  position: 3,
  total: 10,
  done: false,
  counts: { got: 2, review: 1, skip: 0 },
  current: card,
  ...over,
});

const ANSWER = "A function that keeps its scope.";

afterEach(cleanup);

function setup(over: Partial<SessionView> = {}, onResult = vi.fn(() => Promise.resolve(view({ position: 4 })))) {
  const onFinish = vi.fn();
  render(<QuizCard view={view(over)} onResult={onResult} onFinish={onFinish} />);
  return { onResult, onFinish, user: userEvent.setup() };
}

describe("QuizCard", () => {
  it("shows the position, label and question but hides the answer until revealed", () => {
    setup();
    expect(screen.getByText("4 / 10")).toBeTruthy();
    expect(screen.getByText("JavaScript · Fundamentals")).toBeTruthy();
    expect(screen.getByText("What is a closure?")).toBeTruthy();
    expect(screen.queryByText(ANSWER)).toBeNull();
  });

  it("reveals the answer with Space and with the Show answer button", async () => {
    const { user } = setup();
    await user.keyboard(" ");
    expect(screen.getByText(ANSWER)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show answer/i })).toBeNull();

    cleanup();
    const second = setup();
    await second.user.click(screen.getByRole("button", { name: /show answer/i }));
    expect(screen.getByText(ANSWER)).toBeTruthy();
  });

  it("maps G, R and S to got, review and skip", async () => {
    const { onResult, user } = setup();
    await user.keyboard("g");
    expect(onResult).toHaveBeenLastCalledWith("got");
    cleanup();

    const review = setup();
    await review.user.keyboard("r");
    expect(review.onResult).toHaveBeenLastCalledWith("review");
    cleanup();

    const skip = setup();
    await skip.user.keyboard("S");
    expect(skip.onResult).toHaveBeenLastCalledWith("skip");
  });

  it("sends one result when G is pressed again while the first call is pending", async () => {
    let resolve!: (v: SessionView) => void;
    const onResult = vi.fn(() => new Promise<SessionView>((r) => (resolve = r)));
    const { user } = setup({}, onResult);
    await user.keyboard("g");
    await user.keyboard("g");
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(onResult).toHaveBeenCalledTimes(1);
    for (const name of ["Got it", "Review", "Skip"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    await act(async () => resolve(view({ position: 4 })));
    expect((screen.getByRole("button", { name: "Got it" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores shortcuts while typing in an input or with a modifier key", async () => {
    const onResult = vi.fn(() => Promise.resolve(view()));
    render(
      <>
        <input aria-label="notes" />
        <QuizCard view={view()} onResult={onResult} onFinish={vi.fn()} />
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("notes"));
    await user.keyboard("g r s ");
    expect(onResult).not.toHaveBeenCalled();
    expect(screen.queryByText(ANSWER)).toBeNull();

    (document.activeElement as HTMLElement).blur();
    await user.keyboard("{Control>}g{/Control}");
    await user.keyboard("{Meta>}r{/Meta}");
    expect(onResult).not.toHaveBeenCalled();
  });

  it("shows an error and re-enables the buttons when saving fails", async () => {
    const onResult = vi.fn(() => Promise.reject(new Error("boom")));
    const { user } = setup({}, onResult);
    await user.keyboard("g");
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not save/i);
    expect((screen.getByRole("button", { name: "Got it" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onFinish from End quiz", async () => {
    const { onFinish, user } = setup();
    await user.click(screen.getByRole("button", { name: "End quiz" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("links to the graph topic when the card has one", () => {
    setup({ current: { ...card, topic: { graphSlug: "javascript", nodeSlug: "closures", title: "Closures" } } });
    const link = screen.getByRole("link", { name: /Closures/ });
    expect(link.getAttribute("href")).toBe("/graphs/javascript?topic=closures");
  });

  it("shows the counts and a way back when the session is done", () => {
    setup({ done: true, current: null, position: 10, counts: { got: 6, review: 3, skip: 1 } });
    expect(screen.getByText("Quiz complete")).toBeTruthy();
    expect(screen.getByText("6").nextSibling?.textContent).toBe("Got it");
    expect(screen.getByText("3").nextSibling?.textContent).toBe("Review");
    expect(screen.getByText("1").nextSibling?.textContent).toBe("Skipped");
    expect(screen.getByRole("link", { name: "Back to Interview" }).getAttribute("href")).toBe("/interview");
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  describe("with the AI coach", () => {
    const feedback = {
      verdict: "partial" as const,
      score: 60,
      summary: "Right idea, thin on detail.",
      strengths: ["Mentions scope"],
      missing: ["Lexical environment"],
      followUp: "Values or variables?",
      suggested: "review" as const,
    };

    function withCoach(over: Partial<QuizCoach> = {}) {
      const coach: QuizCoach = {
        grade: vi.fn(async () => ({ ok: true as const, value: feedback })),
        ask: vi.fn(async () => ({ ok: true as const, value: "Variables." })),
        ...over,
      };
      const onResult = vi.fn(() => Promise.resolve(view({ position: 4 })));
      render(<QuizCard view={view()} onResult={onResult} onFinish={vi.fn()} coach={coach} />);
      return { coach, onResult, user: userEvent.setup() };
    }

    it("has no answer box without a coach", () => {
      setup();
      expect(screen.queryByLabelText("Your answer")).toBeNull();
    });

    it("grades the typed answer, then shows feedback, the reference answer and the suggestion", async () => {
      const { coach, user } = withCoach();
      expect((screen.getByRole("button", { name: /check with ai/i }) as HTMLButtonElement).disabled).toBe(true);
      await user.type(screen.getByLabelText("Your answer"), "Keeps scope g r s ");
      await user.click(screen.getByRole("button", { name: /check with ai/i }));
      expect(coach.grade).toHaveBeenCalledWith("q1", "Keeps scope g r s ");
      expect(await screen.findByText("Partly right")).toBeTruthy();
      expect(screen.getByText("60 / 100")).toBeTruthy();
      expect(screen.getByText("Lexical environment")).toBeTruthy();
      expect(screen.getByText(ANSWER)).toBeTruthy();
      expect(screen.getByText("Coach suggests: Review")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Review" }).getAttribute("aria-describedby")).toBe("quiz-suggested");
      // The follow-up chat opens with the coach's question.
      expect(screen.getByText("Values or variables?")).toBeTruthy();
    });

    it("does not treat typing in the answer box as shortcuts", async () => {
      const { onResult, user } = withCoach();
      await user.type(screen.getByLabelText("Your answer"), "g s r  ");
      expect(onResult).not.toHaveBeenCalled();
      expect(screen.queryByText(ANSWER)).toBeNull();
    });

    it("checks with Ctrl+Enter", async () => {
      const { coach, user } = withCoach();
      await user.type(screen.getByLabelText("Your answer"), "Keeps scope");
      await user.keyboard("{Control>}{Enter}{/Control}");
      expect(coach.grade).toHaveBeenCalledTimes(1);
    });

    it("shows a coach error and keeps the answer hidden", async () => {
      const { user } = withCoach({ grade: vi.fn(async () => ({ ok: false as const, error: "Limit reached." })) });
      await user.type(screen.getByLabelText("Your answer"), "x");
      await user.click(screen.getByRole("button", { name: /check with ai/i }));
      expect((await screen.findByRole("alert")).textContent).toBe("Limit reached.");
      expect(screen.queryByText(ANSWER)).toBeNull();
    });

    it("sends follow-ups with the conversation so far and shows the reply", async () => {
      const { coach, user } = withCoach();
      await user.type(screen.getByLabelText("Your answer"), "Keeps scope");
      await user.click(screen.getByRole("button", { name: /check with ai/i }));
      await user.type(await screen.findByLabelText("Message the AI coach"), "Values?");
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect(coach.ask).toHaveBeenCalledWith(
        "q1",
        [
          { role: "assistant", content: "Values or variables?" },
          { role: "user", content: "Values?" },
        ],
        "Keeps scope",
      );
      expect(await screen.findByText("Variables.")).toBeTruthy();
    });

    it("offers a follow-up after revealing without grading, and restores the draft on error", async () => {
      const { user } = withCoach({ ask: vi.fn(async () => ({ ok: false as const, error: "Busy." })) });
      await user.click(screen.getByRole("button", { name: /show answer/i }));
      await user.click(screen.getByRole("button", { name: /ask the ai coach/i }));
      await user.type(screen.getByLabelText("Message the AI coach"), "Why?");
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect((await screen.findByRole("alert")).textContent).toBe("Busy.");
      expect((screen.getByLabelText("Message the AI coach") as HTMLTextAreaElement).value).toBe("Why?");
    });
  });
});
