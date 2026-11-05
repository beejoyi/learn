"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearAiKeyAction, saveAiKeyAction } from "@/app/(app)/admin/ai/actions";
import { inputClass } from "@/components/admin/SaveBar";
import { Button } from "@/components/ui/button";
import type { AiKeySource } from "@/lib/aiSettings";

const API_KEY_MAX = 300;

/**
 * Sets or removes the OpenRouter key. The key is write-only: the server only ever tells the page
 * where the key in effect comes from and its last four characters.
 */
export function AiKeyForm({
  source,
  hint,
  updatedAt,
  unreadable,
}: {
  source: AiKeySource;
  hint?: string;
  updatedAt?: string;
  unreadable: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError("");
      setNotice("");
      const result = await saveAiKeyAction(key);
      if (!result.ok) return setError(result.error);
      setKey("");
      const v = result.verified;
      setNotice(
        v.status === "valid"
          ? `Key saved and verified${v.label ? ` (${v.label})` : ""}${v.freeTier ? ". It is on OpenRouter's free tier." : "."}`
          : "Key saved, but OpenRouter could not be reached to verify it. Use Test models below to check.",
      );
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      setError("");
      await clearAiKeyAction();
      setNotice(source === "settings" ? "Saved key removed." : "");
      router.refresh();
    });

  const status =
    source === "settings" ? (
      <>
        Using the key saved here, ending in <code>…{hint}</code>
        {updatedAt && <span className="text-muted-foreground"> · saved {updatedAt}</span>}. It overrides{" "}
        <code>OPENROUTER_API_KEY</code>.
      </>
    ) : source === "env" ? (
      <>
        Using <code>OPENROUTER_API_KEY</code> from the environment. A key saved here replaces it.
      </>
    ) : (
      <>
        <strong>No key yet.</strong> Create one at{" "}
        <a href="https://openrouter.ai/keys" className="underline" target="_blank" rel="noreferrer">
          openrouter.ai/keys
        </a>{" "}
        (a free account works with free models). The coach stays off until a key is set.
      </>
    );

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="OpenRouter API key">
      <h2 className="font-medium">OpenRouter API key</h2>
      <p className="text-sm">{status}</p>
      {unreadable && (
        <p role="alert" className="text-sm text-destructive">
          A saved key can no longer be read (AUTH_SECRET changed). Enter it again or remove it.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          aria-label="New OpenRouter API key"
          placeholder={source === "settings" ? "Paste a new key to replace it" : "sk-or-v1-…"}
          autoComplete="off"
          spellCheck={false}
          maxLength={API_KEY_MAX}
          className={`${inputClass} min-w-0 flex-1 basis-64 font-mono`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <Button type="submit" disabled={pending || !key.trim()}>
          {pending ? "Checking…" : "Save key"}
        </Button>
        {(source === "settings" || unreadable) && (
          <Button type="button" variant="outline" disabled={pending} onClick={remove}>
            Remove saved key
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Stored encrypted with AUTH_SECRET and never shown again. Changing AUTH_SECRET means entering it again.
      </p>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
