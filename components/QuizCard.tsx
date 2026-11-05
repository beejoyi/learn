"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerBox, FeedbackPanel, FollowUpChat } from "@/components/QuizCoach";
import { Button, buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";
import type { MarkResult } from "@/progress/questions";
import type { SessionView } from "@/progress/quiz";
import type { AiGrade, AiReply, AiResult } from "@/progress/quizAi";
import { cn } from "@/lib/utils";

type Card = NonNullable<SessionView["current"]>;

export type QuizCardProps = {
  view: SessionView;
  /** Records the mark and resolves with the session as it now stands. */
  onResult: (result: MarkResult) => Promise<SessionView>;
  onFinish: () => void;
  /** The AI coach (OpenRouter); without it the card is a plain flashcard. */
  coach?: QuizCoach;
};

export type QuizCoach = {
  grade: (questionId: string, answer: string) => Promise<AiResult<AiGrade>>;
  ask: (
    questionId: string,
    input: { conversationId?: string; message: string; answer?: string },
  ) => Promise<AiResult<AiReply>>;
};

const KEYS: Record<string, MarkResult> = { g: "got", r: "review", s: "skip" };

/** Typing, modifier chords and key repeat must never trigger a shortcut. */
function ignoresShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.repeat) return true;
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Space already activates a focused button, link or summary, so it must not also reveal. */
const activatesOnSpace = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("button, a[href], summary, [role='button']"));

const suggestedRing = "ring-2 ring-ring ring-offset-2 ring-offset-card";

export function QuizCard({ view, onResult, onFinish, coach }: QuizCardProps) {
  if (view.done || !view.current) return <Done view={view} />;
  // A new card (or the same question coming back later) starts hidden and enabled.
  return <Live key={`${view.position}:${view.current.id}`} view={view} card={view.current} onResult={onResult} onFinish={onFinish} coach={coach} />;
}

function Live({ view, card, onResult, onFinish, coach }: QuizCardProps & { card: Card }) {
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<AiGrade | null>(null);
  const [checking, setChecking] = useState(false);
  const [coachError, setCoachError] = useState("");
  // Like `busy`: blocks a second check, and every shortcut, while a check is in flight.
  const checkingRef = useRef(false);
  const feedback = grade?.feedback ?? null;

  async function check() {
    if (!coach || checkingRef.current || !answer.trim()) return;
    checkingRef.current = true;
    setChecking(true);
    setCoachError("");
    try {
      const result = await coach.grade(card.id, answer);
      if (result.ok) {
        setGrade(result.value);
        setRevealed(true);
      } else setCoachError(result.error);
    } catch {
      setCoachError("The AI coach failed. Try again.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }
  // State updates are asynchronous; the ref is what stops a second key press in the same tick.
  const busy = useRef(false);

  const mark = useCallback(
    async (result: MarkResult) => {
      if (busy.current || checkingRef.current) return;
      busy.current = true;
      setPending(true);
      setFailed(false);
      try {
        await onResult(result);
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [onResult],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (ignoresShortcut(e) || checkingRef.current) return;
      if (e.key === " ") {
        if (activatesOnSpace(e.target)) return;
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const result = KEYS[e.key.toLowerCase()];
      if (!result) return;
      e.preventDefault();
      void mark(result);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mark]);

  const label = [card.bookTitle, card.partTitle].filter(Boolean).join(" · ");

  return (
    <section aria-label="Quiz card" className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {view.position + 1} / {view.total}
        </span>
      </div>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-ok" style={{ width: `${(view.position / Math.max(view.total, 1)) * 100}%` }} />
      </div>

      <h1 className="mt-5 text-xl font-semibold leading-snug">
        <Markdown source={card.question} inline />
      </h1>
      {card.prompt && (
        <div className="mt-3">
          <Markdown source={card.prompt} />
        </div>
      )}

      {coach && !revealed && (
        <div className="mt-4">
          <AnswerBox value={answer} onChange={setAnswer} onCheck={() => void check()} pending={checking} />
          {coachError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {coachError}
            </p>
          )}
        </div>
      )}

      <div aria-live="polite" className="mt-4 grid gap-4">
        {revealed && coach && answer.trim() && !feedback && (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm">
            <p className="text-muted-foreground">Your answer</p>
            <p className="mt-1 whitespace-pre-wrap">{answer}</p>
          </div>
        )}
        {grade && <FeedbackPanel feedback={grade.feedback} model={grade.model} />}
        {revealed ? (
          <div className="rounded-lg border border-border bg-background p-4">
            {coach && <p className="mb-2 text-sm text-muted-foreground">Reference answer</p>}
            <Markdown source={card.answer} />
          </div>
        ) : (
          <div>
            <Button type="button" variant="outline" disabled={checking} onClick={() => setRevealed(true)}>
              Show answer
              <kbd className="ml-1 rounded border border-border px-1 text-xs text-muted-foreground">Space</kbd>
            </Button>
          </div>
        )}
        {revealed && coach && (
          <FollowUpChat
            // A new conversation (a grade) starts a fresh chat; the opener is only read on mount.
            key={grade?.conversationId ?? "ungraded"}
            opener={feedback?.followUp || undefined}
            conversationId={grade?.conversationId}
            ask={(input) => coach.ask(card.id, { ...input, answer })}
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || checking}
            onClick={() => void mark("got")}
            aria-describedby={feedback?.suggested === "got" ? "quiz-suggested" : undefined}
            className={cn("bg-ok text-background hover:bg-ok/85", feedback?.suggested === "got" && suggestedRing)}
          >
            Got it
          </Button>
          <Button
            type="button"
            disabled={pending || checking}
            onClick={() => void mark("review")}
            aria-describedby={feedback?.suggested === "review" ? "quiz-suggested" : undefined}
            className={cn("bg-track-1 text-background hover:bg-track-1/85", feedback?.suggested === "review" && suggestedRing)}
          >
            Review
          </Button>
          <Button type="button" variant="outline" disabled={pending || checking} onClick={() => void mark("skip")}>
            Skip
          </Button>
        </div>
        {feedback && (
          <span id="quiz-suggested" className="text-xs text-muted-foreground">
            Coach suggests: {feedback.suggested === "got" ? "Got it" : "Review"}
          </span>
        )}
        {card.topic && (
          <Link
            href={`/graphs/${encodeURIComponent(card.topic.graphSlug)}?topic=${encodeURIComponent(card.topic.nodeSlug)}`}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Graph topic: {card.topic.title}
          </Link>
        )}
      </div>

      {failed && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Could not save that answer. Try again.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          Keys: Space shows the answer, G got it, R review, S skip{coach ? ", Ctrl+Enter checks your answer" : ""}.
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onFinish}>
          End quiz
        </Button>
      </div>
    </section>
  );
}

function Done({ view }: { view: SessionView }) {
  const stats: [number, string][] = [
    [view.counts.got, "Got it"],
    [view.counts.review, "Review"],
    [view.counts.skip, "Skipped"],
  ];
  return (
    <section aria-label="Quiz result" className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="text-2xl font-semibold">Quiz complete</h1>
      <div className="mt-5 flex justify-center gap-8">
        {stats.map(([count, label]) => (
          <div key={label} className="grid">
            <span className="text-3xl font-bold tabular-nums">{count}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <Link href="/interview" className={cn(buttonVariants(), "mt-6")}>
        Back to Interview
      </Link>
    </section>
  );
}
