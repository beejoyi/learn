"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AI_ANSWER_MAX, AI_MESSAGE_MAX } from "@/lib/ai-limits";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";
import type { AiChatMessage, AiFeedback, AiReply, AiResult, AiVerdict } from "@/progress/quizAi";

const fieldClass =
  "w-full rounded-lg border border-border bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring read-only:opacity-60";

const isSubmitChord = (e: React.KeyboardEvent) => e.key === "Enter" && (e.ctrlKey || e.metaKey);

/** Where the learner types an answer before revealing; Ctrl/Cmd+Enter checks it. */
export function AnswerBox({
  value,
  onChange,
  onCheck,
  pending,
}: {
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor="quiz-answer" className="text-sm text-muted-foreground">
        Your answer
      </label>
      <textarea
        id="quiz-answer"
        rows={4}
        maxLength={AI_ANSWER_MAX}
        value={value}
        // Read-only rather than disabled: a disabled box drops focus to <body>, where Space and G/R/S are shortcuts.
        readOnly={pending}
        aria-busy={pending}
        placeholder="Answer as you would in an interview, then let the AI coach check it."
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitChord(e)) {
            e.preventDefault();
            if (value.trim() && !pending) onCheck();
          }
        }}
        className={fieldClass}
      />
      <div>
        <Button type="button" disabled={pending || !value.trim()} onClick={onCheck}>
          {pending ? "Checking…" : "Check with AI"}
          {!pending && <kbd className="ml-1 rounded border border-current/30 px-1 text-xs opacity-80">Ctrl+Enter</kbd>}
        </Button>
      </div>
    </div>
  );
}

const VERDICT: Record<AiVerdict, { label: string; className: string }> = {
  correct: { label: "Correct", className: "border-ok/40 bg-ok/10 text-ok" },
  partial: { label: "Partly right", className: "border-track-1/40 bg-track-1/10 text-track-1" },
  incorrect: { label: "Not quite", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export function FeedbackPanel({ feedback, model }: { feedback: AiFeedback; model?: string }) {
  const verdict = VERDICT[feedback.verdict];
  return (
    <section aria-label="AI feedback" className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-sm font-medium", verdict.className)}>
          {verdict.label}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">{feedback.score} / 100</span>
      </div>
      <p className="mt-3 text-sm">{feedback.summary}</p>
      <FeedbackList title="What you got right" items={feedback.strengths} />
      <FeedbackList title="What to add or fix" items={feedback.missing} />
      {model && <p className="mt-3 text-xs text-muted-foreground">Checked by {model}</p>}
    </section>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A short conversation with the coach about the card. The server keeps the history; the chat only
 * sends the new message and the conversation id. When grading produced a follow-up question, the
 * chat opens with it (it is already the conversation's first message on the server).
 */
export function FollowUpChat({
  opener,
  conversationId: initialId,
  ask,
}: {
  opener?: string;
  conversationId?: string;
  ask: (input: { conversationId?: string; message: string }) => Promise<AiResult<AiReply>>;
}) {
  const [messages, setMessages] = useState<AiChatMessage[]>(opener ? [{ role: "assistant", content: opener }] : []);
  const [conversationId, setConversationId] = useState(initialId);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(Boolean(opener));
  const busy = useRef(false);

  async function send() {
    const content = draft.trim();
    if (!content || busy.current) return;
    busy.current = true;
    const before = messages;
    setMessages([...before, { role: "user", content }]);
    setDraft("");
    setPending(true);
    setError("");
    try {
      const result = await ask({ conversationId, message: content });
      if (!result.ok) throw new Error(result.error);
      setConversationId(result.value.conversationId);
      setMessages([...before, { role: "user", content }, { role: "assistant", content: result.value.reply }]);
    } catch (e) {
      setMessages(before);
      setDraft(content);
      setError(e instanceof Error && e.message ? e.message : "The AI coach failed. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ask the AI coach a follow-up
      </Button>
    );
  }

  return (
    <section aria-label="Follow-up with the AI coach" className="grid gap-3 rounded-lg border border-border bg-background p-4">
      <h2 className="text-sm font-medium">Follow-up</h2>
      {messages.length > 0 && (
        <ol aria-live="polite" className="grid gap-2">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                m.role === "user" ? "justify-self-end bg-muted" : "justify-self-start border border-border",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Coach: "}</span>
              {m.role === "assistant" ? <Markdown source={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </li>
          ))}
          {pending && <li className="text-sm text-muted-foreground">Coach is thinking…</li>}
        </ol>
      )}
      <label htmlFor="quiz-followup" className="sr-only">
        Message the AI coach
      </label>
      <textarea
        id="quiz-followup"
        rows={2}
        maxLength={AI_MESSAGE_MAX}
        value={draft}
        readOnly={pending}
        placeholder={messages.length ? "Answer the coach or ask something else…" : "Ask about this question…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitChord(e)) {
            e.preventDefault();
            void send();
          }
        }}
        className={fieldClass}
      />
      <div>
        <Button type="button" size="sm" disabled={pending || !draft.trim()} onClick={() => void send()}>
          Send
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
