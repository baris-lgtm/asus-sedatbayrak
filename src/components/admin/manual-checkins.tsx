"use client";

import { useActionState } from "react";
import { setManualCheckinsAction, type ActionState } from "@/app/admin/actions";

/** Kapıda QR okutulmadan sayılarak alınan katılımcıları ayrı bir sayı olarak kaydeder. */
export function ManualCheckins({ count, note }: { count: number; note: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    try {
      return await setManualCheckinsAction(prev, fd);
    } catch {
      return { ok: false, message: "Sunucuya ulaşılamadı. Tekrar dene." };
    }
  }, {});
  return (
    <details className="border border-rule bg-paper p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Kapıda sayılarak alınan giriş ({count})</summary>
      <p className="mt-2 text-graphite">
        QR okutulmadan içeri alınan ve yalnızca sayılan katılımcılar. Kimse tek tek “giriş yaptı” diye işaretlenmez; bu sayı
        “Giriş yapan” toplamına ayrı olarak eklenir.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label>
          <span className="block font-semibold">Kişi sayısı</span>
          <input name="count" type="number" min={0} max={5000} defaultValue={count} required className="field-input mt-1 !w-28" />
        </label>
        <label className="min-w-60 flex-1">
          <span className="block font-semibold">Not (isteğe bağlı)</span>
          <input name="note" maxLength={200} defaultValue={note ?? ""} placeholder="ör. 21 Kasım, kapıda sayıldı" className="field-input mt-1" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
      {state.message && <p className={`mt-2 ${state.ok === false ? "font-medium text-err" : "text-ok"}`}>{state.message}</p>}
    </details>
  );
}
