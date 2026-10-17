"use client";

import { createContext, useActionState, useContext, useState } from "react";
import type { ActionState } from "@/app/admin/actions";

/**
 * İşlem sonucu, işlemi yapan buton işlemden sonra kaybolsa bile (ör. "İncelemeye al"
 * sonrası) görünür kalsın diye ortak bir canlı bölgede gösterilir.
 */
const FeedbackContext = createContext<((s: ActionState) => void) | null>(null);

export function ActionFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [last, setLast] = useState<ActionState | null>(null);
  return (
    <FeedbackContext.Provider value={setLast}>
      <div aria-live="polite" role="status">
        {last?.message && (
          <p className={`border-l-4 px-3 py-2 text-sm ${last.ok === false ? "border-err bg-red-50 font-medium text-err" : "border-ok bg-green-50 text-ok"}`}>
            {last.message}
          </p>
        )}
      </div>
      {children}
    </FeedbackContext.Provider>
  );
}

/** Tek bir admin işlemi. Geri alınması zor işlemlerde tarayıcı onayı istenir. */
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
  const report = useContext(FeedbackContext);
  // Sonuç, işlemin kendisiyle aynı geçişte (transition) bildirilir; buton yeni durumda
  // kaybolsa bile mesaj ortak alanda görünür.
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    report?.(result);
    return result;
  }, {});

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
      {!report && state.message && (
        <p aria-live="polite" className={`text-sm ${state.ok === false ? "font-medium text-err" : "text-ok"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
