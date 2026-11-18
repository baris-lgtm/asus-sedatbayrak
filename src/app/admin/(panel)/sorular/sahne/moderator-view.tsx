"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { listStageQuestions, setStageStatusAction, type StageList, type StageResult } from "@/app/admin/stage-actions";

const POLL_MS = 5000;

/** Moderatör için: ekibin ilettiği sorular, iletiliş sırasıyla, büyük yazıyla. */
export function ModeratorView({ initial }: { initial: StageList }) {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState<StageResult | null>(initial.ok ? null : initial);
  const [pending, start] = useTransition();
  const [size, setSize] = useState<"md" | "lg">("lg");

  const refresh = useCallback(async () => {
    const next = await listStageQuestions();
    if (next.ok) {
      setData(next);
      setNotice(null);
    } else setNotice(next);
  }, []);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const { queue, asked, similar } = useMemo(() => {
    const similar = new Map<string, number>();
    for (const q of data.questions) if (q.merged_into) similar.set(q.merged_into, (similar.get(q.merged_into) ?? 0) + 1);
    const queue = data.questions.filter((q) => q.status === "selected").sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at));
    const asked = data.questions.filter((q) => q.status === "asked").sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at));
    return { queue, asked, similar };
  }, [data.questions]);

  const mark = (id: string, status: "asked" | "selected") =>
    start(async () => {
      const r = await setStageStatusAction([id], status);
      if (!r.ok) setNotice(r);
      await refresh();
    });

  return (
    <div className="min-h-[75dvh] rounded-[6px] bg-night px-5 py-8 font-headline text-white sm:px-10 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow-line">Moderatör</p>
            <h1 className="headline mt-3 text-3xl sm:text-4xl">Sahneye iletilen sorular</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className="tabular-nums">{queue.length} soru sırada</span>
            <button type="button" onClick={() => setSize((s) => (s === "lg" ? "md" : "lg"))} className="rounded-[3px] border border-white/25 px-3 py-1.5 hover:border-white/60">
              {size === "lg" ? "Yazıyı küçült" : "Yazıyı büyüt"}
            </button>
            <Link href="/admin/sorular" className="underline underline-offset-4">Soru listesi</Link>
          </div>
        </div>

        {notice?.message && (
          <p role="alert" className="mt-4 text-sm text-[#ff8d84]">
            {notice.message}
          </p>
        )}

        {queue.length === 0 ? (
          <p className="mt-12 rounded-[4px] border border-dashed border-white/15 px-6 py-16 text-center text-white/60">
            Henüz iletilen soru yok. Ekip soru seçtiğinde burada görünecek.
          </p>
        ) : (
          <ol className="mt-8 space-y-4">
            {queue.map((q, i) => (
              <li key={q.id} className={`rounded-[4px] border p-5 sm:p-7 ${i === 0 ? "border-copper bg-copper/10" : "border-white/12 bg-white/[0.03]"}`}>
                <div className="flex items-start gap-4 sm:gap-6">
                  <span className={`headline tabular-nums text-copper ${size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`whitespace-pre-wrap break-words leading-snug ${size === "lg" ? "text-[1.6rem] sm:text-[2.1rem]" : "text-xl sm:text-2xl"}`}>{q.body}</p>
                    <p className="mt-3 text-sm text-white/60">
                      {q.author_name ?? "İsimsiz"}
                      {similar.get(q.id) ? <span className="ml-3 text-copper">+{similar.get(q.id)} kişi benzerini sordu</span> : null}
                    </p>
                  </div>
                  <button type="button" disabled={pending} onClick={() => mark(q.id, "asked")} className="btn-copper shrink-0 !min-h-11 !px-4 !text-sm">
                    Soruldu
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {asked.length > 0 && (
          <details className="mt-10 text-white/70">
            <summary className="cursor-pointer text-sm">Sorulanlar ({asked.length})</summary>
            <ul className="mt-3 space-y-2">
              {asked.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-4 border-b border-white/10 py-2 text-sm">
                  <span className="min-w-0 break-words">{q.body}</span>
                  <button type="button" disabled={pending} onClick={() => mark(q.id, "selected")} className="shrink-0 underline">
                    Sıraya geri al
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
