"use client";

import { useState, useTransition } from "react";
import { deleteQuizAttemptAction, resetQuizAction, setQuizOpenAction, type QuizActionResult } from "@/app/admin/quiz-actions";

function Notice({ r }: { r: QuizActionResult | null }) {
  if (!r) return null;
  return (
    <p role="status" className={`mt-2 text-sm ${r.ok ? "text-ok" : "text-err"}`}>
      {r.message}
      {r.sessionExpired && (
        <>
          {" "}
          <a className="underline" href="/admin/login">Giriş yap</a>
        </>
      )}
    </p>
  );
}

export function QuizOpenToggle({ open }: { open: boolean }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<QuizActionResult | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (open && !confirm("Quiz kapatılsın mı? Çözmekte olanlar da cevap gönderemez.")) return;
          start(async () => setR(await setQuizOpenAction(!open)));
        }}
        className={`btn ${open ? "btn-secondary" : "btn-primary"}`}
      >
        {pending ? "Kaydediliyor…" : open ? "Quizi kapat" : "Quizi aç"}
      </button>
      <Notice r={r} />
    </div>
  );
}

export function DeleteAttemptButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<QuizActionResult | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-label={`${name} denemesini sil`}
        onClick={() => {
          if (!confirm(`${name} adlı katılımcının denemesi silinsin mi?`)) return;
          start(async () => setR(await deleteQuizAttemptAction(id)));
        }}
        className="text-xs text-err underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? "Siliniyor…" : "Sil"}
      </button>
      {r && !r.ok && <span className="ml-2 text-xs text-err">{r.message}</span>}
    </span>
  );
}

export function ResetQuiz({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [r, setR] = useState<QuizActionResult | null>(null);
  return (
    <section className="rounded border border-rule bg-surface p-5">
      <h2 className="text-lg font-semibold">Quizi sıfırla</h2>
      <p className="mt-1 text-sm text-graphite">
        Prova sonrasında veya etkinlikten önce tüm denemeleri ({count}) kalıcı olarak siler. Geri alınamaz.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await resetQuizAction(text);
            setR(res);
            if (res.ok) setText("");
          });
        }}
      >
        <label className="text-sm">
          <span className="sr-only">Onay metni</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="SIFIRLA" className="field-input !w-40" aria-label="Onaylamak için SIFIRLA yaz" />
        </label>
        <button type="submit" disabled={pending || count === 0} className="btn btn-secondary">
          {pending ? "Siliniyor…" : "Tüm denemeleri sil"}
        </button>
      </form>
      <Notice r={r} />
    </section>
  );
}
