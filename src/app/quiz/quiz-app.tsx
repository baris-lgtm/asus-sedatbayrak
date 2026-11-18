"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicQuestion } from "@/content/quiz";
import type { QuizResult, QuizState } from "@/lib/server/quiz";
import { QUIZ_PRIZE_COUNT, formatDuration, normalizeQuizName } from "@/lib/quiz-format";
import { ArrowRight } from "@/components/brand";

type Answer = number | null;

type View =
  | { kind: "closed" }
  | { kind: "entry" }
  | { kind: "playing"; attemptId: string; fullName: string; startedAt: number; offset: number; questions: PublicQuestion[] }
  | { kind: "finished"; fullName: string; result: QuizResult };

const LETTERS = ["A", "B", "C", "D"] as const;
const ADVANCE_MS = 320;

function storageKey(attemptId: string) {
  return `quiz:${attemptId}`;
}
function loadProgress(attemptId: string, n: number): { answers: Answer[]; index: number } {
  try {
    const raw = localStorage.getItem(storageKey(attemptId));
    if (raw) {
      const p = JSON.parse(raw) as { answers?: unknown; index?: unknown };
      if (Array.isArray(p.answers) && p.answers.length === n) {
        const answers = p.answers.map((a) => (Number.isInteger(a) && (a as number) >= 0 && (a as number) <= 3 ? (a as number) : null));
        const index = Number.isInteger(p.index) ? Math.min(Math.max(p.index as number, 0), n) : 0;
        return { answers, index };
      }
    }
  } catch {
    /* depolama yok/kapalı: baştan */
  }
  return { answers: Array(n).fill(null), index: 0 };
}
function saveProgress(attemptId: string, answers: Answer[], index: number) {
  try {
    localStorage.setItem(storageKey(attemptId), JSON.stringify({ answers, index }));
  } catch {
    /* sorun değil: ilerleme yalnızca bellekte */
  }
}
function clearProgress(attemptId: string) {
  try {
    localStorage.removeItem(storageKey(attemptId));
  } catch {
    /* yok say */
  }
}

function toView(s: QuizState, questions: PublicQuestion[] | null): View {
  if (s.kind === "in_progress" && questions) {
    return {
      kind: "playing",
      attemptId: s.attemptId,
      fullName: s.fullName,
      startedAt: Date.parse(s.startedAt),
      offset: Date.parse(s.serverNow) - Date.now(),
      questions,
    };
  }
  if (s.kind === "finished") return { kind: "finished", fullName: s.fullName, result: s.result };
  if (s.kind === "closed") return { kind: "closed" };
  return { kind: "entry" };
}

type ApiResponse =
  | { status: "in_progress"; attemptId: string; fullName: string; startedAt: string; serverNow: string; questions: PublicQuestion[] }
  | { status: "finished"; fullName: string; result: QuizResult };

async function post(url: string, body: unknown): Promise<{ ok: true; data: ApiResponse } | { ok: false; code?: string; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, code: data.code, message: data.message || "Bir sorun oluştu. Lütfen tekrar deneyin." };
    return { ok: true, data };
  } catch {
    return { ok: false, code: "network", message: "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin." };
  }
}

export function QuizApp({ initial, questions, totalQuestions }: { initial: QuizState; questions: PublicQuestion[] | null; totalQuestions: number }) {
  const [view, setView] = useState<View>(() => toView(initial, questions));

  const apply = useCallback((data: ApiResponse) => {
    if (data.status === "in_progress") {
      setView({
        kind: "playing",
        attemptId: data.attemptId,
        fullName: data.fullName,
        startedAt: Date.parse(data.startedAt),
        offset: Date.parse(data.serverNow) - Date.now(),
        questions: data.questions,
      });
    } else {
      setView({ kind: "finished", fullName: data.fullName, result: data.result });
    }
    window.scrollTo({ top: 0 });
  }, []);

  if (view.kind === "playing") return (
      <Playing
        key={view.attemptId}
        view={view}
        onFinished={apply}
        onClosed={() => setView({ kind: "closed" })}
        onAbandon={() => {
          clearProgress(view.attemptId);
          void nextParticipant(setView);
        }}
      />
    );
  if (view.kind === "finished") return <Finished fullName={view.fullName} result={view.result} onNext={() => nextParticipant(setView)} />;
  if (view.kind === "closed") return <Closed />;
  return <Entry total={totalQuestions} onStarted={apply} onClosed={() => setView({ kind: "closed" })} />;
}

/** Ortak cihaz: bu cihazın deneme bağlantısını bırakır (deneme kayıtlı kalır), giriş ekranına döner. */
async function nextParticipant(setView: (v: View) => void) {
  try {
    await fetch("/api/quiz/release", { method: "POST" });
  } catch {
    /* çerez silinemediyse sayfa yenilenince yine sonuç görünür; tekrar denenebilir */
  }
  setView({ kind: "entry" });
  window.scrollTo({ top: 0 });
}

/* ——— Giriş ——— */

function Entry({ total, onStarted, onClosed }: { total: number; onStarted: (d: ApiResponse) => void; onClosed: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeQuizName(name);
    if (!clean) {
      setError("Lütfen adınızı ve soyadınızı yazın.");
      return;
    }
    setPending(true);
    setError(null);
    const r = await post("/api/quiz/start", { fullName: clean });
    setPending(false);
    if (r.ok) onStarted(r.data);
    else if (r.code === "closed") onClosed();
    else setError(r.message);
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
      <div className="rise">
        <p className="eyebrow-line">Etkinlik quizi</p>
        <h1 className="headline mt-5 text-[2.5rem] sm:text-6xl">
          Mimarlığın
          <br />
          Evrimi Quiz
        </h1>
        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base">
          Yazılımdan malzemeye, İstanbul mimarlığından şantiye diline {total} soru. Her sorunun tek bir doğru cevabı var.
        </p>
        <ul className="mt-8 grid max-w-md gap-3 text-sm text-white/80">
          {[
            ["01", "Süre, “Quize başla”ya bastığınız anda başlar."],
            ["02", "Sıralama önce doğru sayısına, eşitlikte süreye göre yapılır."],
            ["03", `İlk ${QUIZ_PRIZE_COUNT} kişi hediye kazanır.`],
          ].map(([n, t]) => (
            <li key={n} className="flex gap-4 border-t border-white/10 pt-3">
              <span className="w-6 shrink-0 text-copper">{n}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} noValidate className="rise rise-2 rounded-[4px] border border-white/10 bg-night-2 p-6 sm:p-9">
        <label htmlFor="quiz-name" className="block text-sm font-medium">
          Ad Soyad
        </label>
        <input
          id="quiz-name"
          name="fullName"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="quiz-name-help"
          className="field-dark mt-2 !min-h-12 !text-base"
          placeholder="Adınız ve soyadınız"
        />
        <p id="quiz-name-help" className="mt-2 text-xs leading-relaxed text-white/50">
          Liderlik tablosunda adınız ve soyadınızın baş harfi görünür (ör. “Ayşe Y.”). Hediye tesliminde tam adınız kullanılır.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[#ff8d84]">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-copper arrow-nudge mt-7 w-full !min-h-12">
          {pending ? "Başlatılıyor…" : "Quize başla"}
          <ArrowRight />
        </button>
      </form>
    </section>
  );
}

/* ——— Soru akışı ——— */

function useElapsed(startedAt: number, offset: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, now + offset - startedAt);
}

function Playing({
  view,
  onFinished,
  onClosed,
  onAbandon,
}: {
  view: Extract<View, { kind: "playing" }>;
  onFinished: (d: ApiResponse) => void;
  onClosed: () => void;
  onAbandon: () => void;
}) {
  const n = view.questions.length;
  const [{ answers, index }, setProgress] = useState(() => ({ answers: Array<Answer>(n).fill(null), index: 0 }));
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const elapsed = useElapsed(view.startedAt, view.offset, !submitting);

  // Sayfa yenilense de cevaplar bu cihazda kalır.
  useEffect(() => {
    setProgress(loadProgress(view.attemptId, n));
    setLoaded(true);
  }, [view.attemptId, n]);
  useEffect(() => {
    if (loaded) saveProgress(view.attemptId, answers, index);
  }, [loaded, view.attemptId, answers, index]);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const go = useCallback((i: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setProgress((p) => ({ ...p, index: Math.min(Math.max(i, 0), n) }));
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [n]);

  function choose(opt: number) {
    setProgress((p) => {
      const next = [...p.answers];
      next[p.index] = opt;
      return { ...p, answers: next };
    });
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const from = index;
    advanceTimer.current = setTimeout(() => go(from + 1), ADVANCE_MS);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const r = await post("/api/quiz/submit", { answers });
    if (r.ok) {
      clearProgress(view.attemptId);
      onFinished(r.data);
      return;
    }
    setSubmitting(false);
    if (r.code === "closed") {
      setError(r.message);
      setTimeout(onClosed, 2500);
    } else setError(r.message);
  }

  const answered = answers.filter((a) => a !== null).length;
  const onReview = index >= n;
  const q = onReview ? null : view.questions[index];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-10 pt-6 sm:px-8 sm:pt-10">
      {/* Üst bilgi: ilerleme + süre */}
      <div className="sticky top-0 z-10 -mx-5 bg-night/95 px-5 pb-4 pt-2 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-end justify-between gap-4 text-sm">
          <p className="text-white/70">
            {onReview ? (
              "Gözden geçir"
            ) : (
              <>
                Soru <span className="text-white">{index + 1}</span> / {n}
              </>
            )}
          </p>
          <p className="tabular-nums text-copper" aria-label={`Geçen süre ${formatDuration(elapsed)}`}>
            <span aria-hidden>⏱ </span>
            {formatDuration(elapsed).replace(/,\d$/, "")}
          </p>
        </div>
        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full bg-copper transition-[width] duration-300" style={{ width: `${(answered / n) * 100}%` }} />
        </div>
      </div>

      {q ? (
        <div key={q.id} className="fade-in mt-6 flex flex-1 flex-col sm:mt-10" style={{ animationDuration: "350ms", animationDelay: "0ms" }}>
          <h1 ref={headingRef} tabIndex={-1} className="headline text-[1.45rem] leading-snug outline-none sm:text-[2rem] sm:leading-tight">
            {q.prompt}
          </h1>
          <div role="radiogroup" aria-label="Seçenekler" className="mt-7 grid gap-3 sm:mt-9">
            {q.options.map((opt, i) => {
              const selected = answers[index] === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(i)}
                  className={`group flex min-h-14 w-full items-center gap-4 rounded-[4px] border px-4 py-3 text-left text-[15px] transition-colors sm:px-5 sm:text-base ${
                    selected ? "border-copper bg-copper/15 text-white" : "border-white/14 bg-white/[0.03] text-white/90 hover:border-white/35"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm ${
                      selected ? "border-copper bg-copper text-night" : "border-white/30 text-white/70 group-hover:border-white/60"
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 pt-8">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="btn-ghost-light !border-white/25 disabled:opacity-30">
              Geri
            </button>
            <button type="button" onClick={() => go(index + 1)} className="btn-ghost-light arrow-nudge !border-white/25">
              {answers[index] === null ? "Boş geç" : index === n - 1 ? "Bitir" : "İleri"}
              <ArrowRight />
            </button>
          </div>
        </div>
      ) : (
        <div className="fade-in mt-8 flex flex-1 flex-col" style={{ animationDuration: "350ms", animationDelay: "0ms" }}>
          <h1 ref={headingRef} tabIndex={-1} className="headline text-3xl outline-none sm:text-4xl">
            {answered === n ? "Tüm soruları cevapladınız" : `${n - answered} soru boş`}
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Göndermeden önce bir soruya dönmek için numarasına dokunun. Gönderdikten sonra cevaplar değiştirilemez.
          </p>
          <ol className="mt-7 grid grid-cols-6 gap-2 sm:grid-cols-9" aria-label="Sorular">
            {answers.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Soru ${i + 1}${a === null ? ", boş" : `, cevap ${LETTERS[a]}`}`}
                  className={`flex h-12 w-full flex-col items-center justify-center rounded-[3px] border text-xs tabular-nums ${
                    a === null ? "border-dashed border-white/30 text-white/50" : "border-copper/60 bg-copper/10 text-white"
                  }`}
                >
                  <span>{i + 1}</span>
                  <span className="text-[10px] text-copper">{a === null ? "–" : LETTERS[a]}</span>
                </button>
              </li>
            ))}
          </ol>
          {error && (
            <p role="alert" className="mt-6 text-sm text-[#ff8d84]">
              {error}
            </p>
          )}
          <div className="mt-auto flex flex-col-reverse gap-3 pt-10 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => go(n - 1)} className="btn-ghost-light !border-white/25">
              Son soruya dön
            </button>
            <button type="button" onClick={submit} disabled={submitting} className="btn-copper arrow-nudge !min-h-12 sm:min-w-64">
              {submitting ? "Gönderiliyor…" : "Cevapları gönder"}
              <ArrowRight />
            </button>
          </div>
        </div>
      )}
      <p className="mt-6 text-center text-xs text-white/35">
        {view.fullName} ·{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-white/70"
          onClick={() => {
            if (confirm("Bu deneme yarıda bırakılsın mı? Cevaplar gönderilmez ve sıralamaya girmez.")) onAbandon();
          }}
        >
          Katılımcı değiştir
        </button>
      </p>
    </section>
  );
}

/* ——— Sonuç ——— */

function Finished({ fullName, result, onNext }: { fullName: string; result: QuizResult; onNext: () => void }) {
  const inPrize = result.rank <= QUIZ_PRIZE_COUNT;
  const first = fullName.split(" ")[0];
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-12 text-center sm:px-8">
      <p className="eyebrow-line mx-auto rise">Teşekkürler, {first}</p>
      <h1 className="headline rise rise-1 mt-6 text-[3.5rem] sm:text-[5.5rem]">
        {result.correct}
        <span className="text-white/35"> / {result.total}</span>
      </h1>
      <p className="rise rise-1 text-white/70">doğru cevap</p>

      <dl className="rise rise-2 mx-auto mt-10 grid w-full max-w-md grid-cols-2 border-y border-white/10">
        <div className="py-5">
          <dt className="text-xs uppercase tracking-[0.08em] text-white/50">Süre</dt>
          <dd className="mt-1 text-2xl tabular-nums">{formatDuration(result.durationMs)}</dd>
        </div>
        <div className="border-l border-white/10 py-5">
          <dt className="text-xs uppercase tracking-[0.08em] text-white/50">Şu anki sıranız</dt>
          <dd className={`mt-1 text-2xl tabular-nums ${inPrize ? "text-copper" : ""}`}>{result.rank}.</dd>
        </div>
      </dl>

      <p className="rise rise-3 mx-auto mt-8 max-w-md text-[15px] leading-relaxed text-white/75">
        {inPrize
          ? `Şu an ilk ${QUIZ_PRIZE_COUNT}'tesiniz. Quiz kapanana kadar sıralama değişebilir; sonuçları liderlik tablosundan takip edin.`
          : `İlk ${QUIZ_PRIZE_COUNT} kişi hediye kazanır. Quiz kapanana kadar sıralama değişebilir.`}
      </p>
      <div className="rise rise-3 mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={onNext} className="btn-copper arrow-nudge">
          Sonraki katılımcı
          <ArrowRight />
        </button>
        <Link href="/quiz/liderlik" className="btn-ghost-light !border-white/25">
          Liderlik tablosu
        </Link>
      </div>
    </section>
  );
}

function Closed() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
      <p className="eyebrow-line mx-auto">Etkinlik quizi</p>
      <h1 className="headline mt-6 text-4xl sm:text-5xl">Quiz şu anda kapalı</h1>
      <p className="mt-5 text-[15px] leading-relaxed text-white/70">
        Quiz etkinlik sırasında açılacak. Açıldığında bu sayfayı yenilemeniz yeterli.
      </p>
      <Link href="/quiz/liderlik" className="btn-ghost-light arrow-nudge mx-auto mt-9">
        Liderlik tablosu
        <ArrowRight />
      </Link>
    </section>
  );
}
