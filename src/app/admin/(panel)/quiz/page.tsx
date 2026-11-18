import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { quizQuestions } from "@/content/quiz";
import { QUIZ_PRIZE_COUNT, formatDuration } from "@/lib/quiz-format";
import { formatDateTime } from "@/lib/format";
import { DeleteAttemptButton, QuizOpenToggle, ResetQuiz } from "./quiz-controls";

export const metadata: Metadata = { title: "Quiz" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  full_name: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  correct_count: number | null;
  total_questions: number | null;
  answers: { q: string; correct: boolean; chosen: number | null }[] | null;
}

export default async function QuizAdminPage() {
  const staff = await requireAdminPage();
  // Kullanıcının kendi oturumu; RLS yalnızca admin'e okuma izni verir.
  const [{ data: settings, error: sErr }, { data: rows, error: rErr }] = await Promise.all([
    staff.supabase.from("quiz_settings").select("is_open, updated_at").eq("id", 1).single<{ is_open: boolean; updated_at: string }>(),
    staff.supabase
      .from("quiz_attempts")
      .select("id, full_name, started_at, finished_at, duration_ms, correct_count, total_questions, answers")
      .order("started_at", { ascending: true })
      .limit(5000)
      .returns<Row[]>(),
  ]);
  if (sErr || rErr) throw new Error("Quiz verileri okunamadı");

  const all = rows ?? [];
  const finished = all
    .filter((r) => r.finished_at)
    .sort(
      (a, b) =>
        b.correct_count! - a.correct_count! ||
        a.duration_ms! - b.duration_ms! ||
        a.finished_at!.localeCompare(b.finished_at!) ||
        a.id.localeCompare(b.id),
    );
  const inProgress = all.filter((r) => !r.finished_at);

  // Soru bazında doğru oranı
  const perQuestion = quizQuestions.map((q, i) => {
    let correct = 0;
    let seen = 0;
    for (const r of finished) {
      const a = r.answers?.find((x) => x.q === q.id);
      if (a) {
        seen += 1;
        if (a.correct) correct += 1;
      }
    }
    return { n: i + 1, prompt: q.prompt, pct: seen ? Math.round((correct / seen) * 100) : null };
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Etkinlik quizi</h1>
          <p className="mt-2 text-sm leading-relaxed text-graphite">
            Katılımcılar <Link className="underline" href="/quiz" target="_blank">/quiz</Link> sayfasında ad soyad girip {quizQuestions.length} soruyu
            çözer; süre sunucuda ölçülür. Herkese açık <Link className="underline" href="/quiz/liderlik" target="_blank">liderlik tablosunda</Link> adlar
            “Ad S.” biçiminde görünür; tam adlar yalnızca burada. İlk {QUIZ_PRIZE_COUNT} kişi hediye alır.
          </p>
        </div>
        <QuizOpenToggle open={Boolean(settings?.is_open)} />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Durum", settings?.is_open ? "Açık" : "Kapalı"],
          ["Tamamlayan", String(finished.length)],
          ["Devam eden / yarım", String(inProgress.length)],
          ["Son değişiklik", formatDateTime(settings?.updated_at)],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-rule bg-surface p-4">
            <dt className="text-xs text-graphite">{k}</dt>
            <dd className="mt-1 text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Sıralama</h2>
        {finished.length === 0 ? (
          <p className="mt-3 text-sm text-graphite">Henüz quizi tamamlayan yok.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded border border-rule bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-mist text-left text-xs text-graphite">
                <tr>
                  <th className="px-3 py-2">Sıra</th>
                  <th className="px-3 py-2">Ad Soyad</th>
                  <th className="px-3 py-2 text-right">Doğru</th>
                  <th className="px-3 py-2 text-right">Süre</th>
                  <th className="px-3 py-2">Bitiriş</th>
                  <th className="px-3 py-2"><span className="sr-only">İşlem</span></th>
                </tr>
              </thead>
              <tbody>
                {finished.map((r, i) => (
                  <tr key={r.id} className={`border-t border-rule ${i < QUIZ_PRIZE_COUNT ? "bg-[#fbf4ea]" : ""}`}>
                    <td className="px-3 py-2 tabular-nums">
                      {i + 1}
                      {i < QUIZ_PRIZE_COUNT && <span className="ml-2 rounded bg-[#8f6130] px-1.5 py-0.5 text-[10px] font-semibold text-white">Hediye</span>}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.full_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.correct_count}/{r.total_questions}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatDuration(r.duration_ms!)}</td>
                    <td className="px-3 py-2 text-graphite">{formatDateTime(r.finished_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <DeleteAttemptButton id={r.id} name={r.full_name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inProgress.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Devam eden veya yarım bırakılan</h2>
          <ul className="mt-3 divide-y divide-rule rounded border border-rule bg-surface text-sm">
            {inProgress.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {r.full_name} <span className="text-graphite">· başladı {formatDateTime(r.started_at)}</span>
                </span>
                <DeleteAttemptButton id={r.id} name={r.full_name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Soru bazında doğru oranı</h2>
          <ol className="mt-3 grid gap-1.5 text-sm">
            {perQuestion.map((q) => (
              <li key={q.n} className="grid grid-cols-[2rem_1fr_3.5rem] items-center gap-3">
                <span className="tabular-nums text-graphite">{q.n}</span>
                <span className="relative h-6 overflow-hidden rounded bg-mist" title={q.prompt}>
                  <span className="absolute inset-y-0 left-0 bg-[#c8955f]/70" style={{ width: `${q.pct ?? 0}%` }} />
                  <span className="relative block truncate px-2 leading-6">{q.prompt}</span>
                </span>
                <span className="text-right tabular-nums">{q.pct === null ? "–" : `%${q.pct}`}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ResetQuiz count={all.length} />
    </div>
  );
}
