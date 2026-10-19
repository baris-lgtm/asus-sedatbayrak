"use client";

import Link from "next/link";
import { createContext, useActionState, useCallback, useContext, useEffect, useState } from "react";
import type { ActionState } from "@/app/admin/actions";

const NETWORK_ERROR: ActionState = {
  ok: false,
  message: "Sunucuya ulaşılamadı. İşlem kaydedilmiş olabilir: sayfayı yenileyip durumu kontrol et, sonra gerekirse tekrar dene.",
};

/**
 * Bir başvuru sayfasındaki tüm işlemler için ortak durum:
 *  - Sonuç mesajı, işlemi yapan buton işlemden sonra kaybolsa bile görünür kalır.
 *  - Bir işlem sürerken diğer işlem butonları da kilitlenir (ör. aynı anda onay + ret).
 */
interface Feedback {
  report: (s: ActionState) => void;
  setBusy: (delta: 1 | -1) => void;
  busy: boolean;
}
const FeedbackContext = createContext<Feedback | null>(null);

/** Aynı sayfadaki diğer formların (ör. kalıcı silme) ortak kilide katılması için. */
export function useActionLock(pending: boolean): boolean {
  const feedback = useContext(FeedbackContext);
  const setBusy = feedback?.setBusy;
  useEffect(() => {
    if (!pending || !setBusy) return;
    setBusy(1);
    return () => setBusy(-1);
  }, [pending, setBusy]);
  return pending || (feedback?.busy ?? false);
}

function Message({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`border-l-4 px-3 py-2 text-sm ${state.ok === false ? "border-err bg-red-50 font-medium text-err" : "border-ok bg-green-50 text-ok"}`}>
      {state.message}
      {state.sessionExpired && (
        <>
          {" "}
          <Link href="/admin/login" className="underline underline-offset-2">
            Giriş yap
          </Link>
        </>
      )}
    </p>
  );
}

export function ActionFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [last, setLast] = useState<ActionState | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const setBusy = useCallback((d: 1 | -1) => setBusyCount((c) => Math.max(0, c + d)), []);
  return (
    <FeedbackContext.Provider value={{ report: setLast, setBusy, busy: busyCount > 0 }}>
      <div aria-live="polite" role="status">
        {last && <Message state={last} />}
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
  const feedback = useContext(FeedbackContext);
  // Sonuç, işlemin kendisiyle aynı geçişte bildirilir. Ağ kesintisi / sunucu zaman aşımı
  // gibi durumlarda action fırlatır; bunu yakalayıp beyaz sayfa yerine mesaj gösteriyoruz.
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    let result: ActionState;
    try {
      result = await action(prev, fd);
    } catch {
      result = NETWORK_ERROR;
    }
    feedback?.report(result);
    return result;
  }, {});

  const locked = useActionLock(pending);

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
        if (locked) {
          e.preventDefault();
          return;
        }
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
      <button type="submit" className={`${cls} w-full min-h-11 text-sm`} disabled={locked} aria-busy={pending}>
        {pending ? (pendingLabel ?? "İşleniyor…") : label}
      </button>
      {!feedback && <div aria-live="polite"><Message state={state} /></div>}
    </form>
  );
}
