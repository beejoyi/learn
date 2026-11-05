"use client";

import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Transient feedback for things that have no control to sit beside: the control has scrolled out of
 * view, or it lives in a layer that is closing. Anything that *does* have a place on the page should
 * use <Notice> there instead — a message beside the button you just pressed beats a corner of the
 * screen. Mounted once by the (app) layout; `toast()` can be called from any client component.
 */

export type ToastTone = "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const LIFETIME_MS = 6000;
/** Older ones drop off the top rather than filling the screen. */
const MAX_SHOWN = 3;

// The queue is module state, so toast() works from any component without a provider. `items` is
// replaced (never mutated) on every change, which is what makes it a valid external-store snapshot.
let items: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const snapshot = () => items;

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  publish();
}

/** Shows a message. Returns the id, so a caller can take it back early. */
export function toast(message: string, tone: ToastTone = "info"): number {
  const id = nextId++;
  items = [...items, { id, message, tone }].slice(-MAX_SHOWN);
  publish();
  // Timers are per toast; the component is not remounted between them, so this survives re-renders.
  setTimeout(() => dismiss(id), LIFETIME_MS);
  return id;
}

export function Toaster() {
  // Nothing is ever queued during a server render, so the server snapshot is the same empty list.
  const shown = useSyncExternalStore(subscribe, snapshot, snapshot);

  if (!shown.length) return null;
  return (
    // Full width at the bottom on phones, a stack in the corner from sm up. aria-live sits on the
    // region so a toast arriving later is still announced; errors interrupt, the rest wait.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {shown.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-popover p-3 text-sm shadow-lg",
            "animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none",
            t.tone === "error" ? "border-destructive/40 text-destructive" : "border-border text-foreground",
          )}
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="-m-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
