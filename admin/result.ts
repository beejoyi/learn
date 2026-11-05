// The one result shape every admin update returns (Server Actions in app/(app)/admin/**/actions.ts).
// Kept free of server imports so client components can use it.

/** Field name → message. The "_" key is a message for the whole form. */
export type FieldErrors = Record<string, string>;

/** `{ ok: true, ...data }` on success, `{ ok: false, errors }` otherwise. Lookups return plain data instead. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; errors: FieldErrors };

export const ok = <T extends object = object>(data?: T): ActionResult<T> => ({ ok: true, ...(data as T) });
export const fail = (errors: FieldErrors | string): { ok: false; errors: FieldErrors } => ({
  ok: false,
  errors: typeof errors === "string" ? { _: errors } : errors,
});

/** The message to show for a failed result: the whole-form message, else the first field's. */
export const firstError = (errors: FieldErrors): string | undefined => errors._ ?? Object.values(errors)[0];
