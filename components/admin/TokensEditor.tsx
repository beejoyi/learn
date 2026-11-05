"use client";

import { useState } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/(app)/admin/tokens/actions";
import { AdminCard, AdminList, AdminListItem, AdminSection } from "@/components/admin/layout";
import { ActionStatus, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

type Row = { id: string; name: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };

export function TokensEditor({ tokens }: { tokens: Row[] }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useAdminAction();
  const revoke = useAdminAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCopied(false);
    create.run(() => createTokenAction(name), {
      onSuccess: ({ token }) => {
        setFresh(token);
        setName("");
      },
    });
  };

  return (
    <>
      <AdminCard title="New token">
        <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
          <input
            aria-label="Token name"
            placeholder="Name, e.g. laptop CLI"
            className={`${inputClass} max-w-xs`}
            value={name}
            onChange={(e) => {
              create.touch();
              setName(e.target.value);
            }}
          />
          <Button type="submit" disabled={create.pending}>
            Create token
          </Button>
          {/* The new token itself is the success message. */}
          <ActionStatus saved={false} errors={create.errors} />
        </form>

        {fresh && (
          <div role="status" className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Copy this token now. It will not be shown again.</p>
            <code className="break-all rounded bg-background p-2 font-mono text-xs">{fresh}</code>
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fresh);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </AdminCard>

      <AdminSection title={`Tokens (${tokens.length})`}>
        <AdminList empty="No tokens yet." className="text-sm">
          {tokens.map((t) => (
            <AdminListItem
              key={t.id}
              actions={
                !t.revokedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.pending}
                    onClick={() =>
                      revoke.run(() => revokeTokenAction(t.id), {
                        confirm: `Revoke "${t.name}"? Anything using it stops working.`,
                      })
                    }
                  >
                    Revoke
                  </Button>
                )
              }
            >
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                created {t.createdAt}
                {t.lastUsedAt ? ` · last used ${t.lastUsedAt}` : " · never used"}
                {t.revokedAt ? ` · revoked ${t.revokedAt}` : ""}
              </span>
            </AdminListItem>
          ))}
        </AdminList>
        <ActionStatus saved={false} errors={revoke.errors} />
      </AdminSection>
    </>
  );
}
