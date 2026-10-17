"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";

/**
 * Tek bir admin işlemi için form. Sonuç mesajı aria-live ile duyurulur.
 * Geri alınması zor işlemlerde tarayıcı onayı istenir.
 */
export function ActionForm({
  action,
  fields,
  label,
  pendingLabel,
  confirmText,
  variant = "secondary",
  notifyOption,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "danger";
  notifyOption?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const cls =
    variant === "primary"
      ? "btn btn-primary"
      : variant === "danger"
        ? "btn border-err bg-paper text-err hover:bg-err hover:text-paper"
        : "btn btn-secondary";

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="space-y-2"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {notifyOption && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-ink" />
          {notifyOption}
        </label>
      )}
      <button type="submit" className={`${cls} w-full min-h-11 text-sm`} disabled={pending} aria-busy={pending}>
        {pending ? (pendingLabel ?? "İşleniyor…") : label}
      </button>
      <p aria-live="polite" className={`min-h-0 text-sm ${state.ok === false ? "font-medium text-err" : "text-ok"}`}>
        {state.message}
      </p>
    </form>
  );
}
