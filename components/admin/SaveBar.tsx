import type { FieldErrors } from "@/admin/result";
import { Button } from "@/components/ui/button";

/** The outcome of an admin update: "Saved." (or `savedText`), or the first error. */
export function ActionStatus({ saved, errors, savedText = "Saved." }: { saved: boolean; errors: FieldErrors; savedText?: string }) {
  const first = Object.entries(errors).find(([key]) => key === "_") ?? Object.entries(errors)[0];
  if (first) {
    return (
      <span role="alert" className="text-sm text-destructive">
        {first[0] === "_" ? first[1] : `${labelOf(first[0])}: ${first[1]}`}
      </span>
    );
  }
  return saved ? (
    <span role="status" className="text-sm text-muted-foreground">
      {savedText}
    </span>
  ) : null;
}

/** "fallbackModel" → "Fallback model", for errors on fields without their own message slot. */
const labelOf = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (m) => m.toLowerCase());

/** The footer of every admin form: the submit button plus ActionStatus. */
export function SaveBar({
  label,
  pending,
  saved,
  errors,
  children,
}: {
  label: string;
  pending: boolean;
  saved: boolean;
  errors: FieldErrors;
  /** Extra buttons placed after the submit button. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {children}
      <ActionStatus saved={saved} errors={errors} />
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-ring";
