"use client";

import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/server/quiz";
import { QUIZ_PRIZE_COUNT, formatDuration } from "@/lib/quiz-format";

interface Board {
  open: boolean;
  finished: number;
  entries: LeaderboardEntry[];
  updatedAt: string;
}

const POLL_MS = 5000;

function Row({ e, prize }: { e: LeaderboardEntry; prize: boolean }) {
  const podium = e.rank <= 3;
  return (
    <li
      className={`grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[4rem_1fr_7rem_7rem] sm:gap-4 sm:px-5 sm:py-4 ${
        prize ? "border-white/10" : "border-white/[0.06] text-white/60"
      } ${podium ? "bg-copper/[0.07]" : ""}`}
    >
      <span className={`headline tabular-nums ${podium ? "text-2xl text-copper sm:text-3xl" : prize ? "text-lg text-copper/90 sm:text-xl" : "text-base sm:text-lg"}`}>
        {e.rank}
      </span>
      <span className="min-w-0">
        <span className={`block truncate ${podium ? "text-lg sm:text-2xl" : "text-[15px] sm:text-lg"}`}>{e.name}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-white/50 sm:hidden">{formatDuration(e.durationMs)}</span>
      </span>
      <span className="text-right tabular-nums sm:text-lg">
        {e.correct}
        <span className="text-white/40">/{e.total}</span>
      </span>
      <span className="hidden text-right tabular-nums text-white/70 sm:block sm:text-lg">{formatDuration(e.durationMs)}</span>
    </li>
  );
}

export function LiveLeaderboard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch("/api/quiz/leaderboard", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const next = (await res.json()) as Board;
        if (alive) {
          setBoard(next);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
      if (alive) timer = setTimeout(tick, document.hidden ? POLL_MS * 3 : POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const prize = board.entries.filter((e) => e.rank <= QUIZ_PRIZE_COUNT);
  const rest = board.entries.filter((e) => e.rank > QUIZ_PRIZE_COUNT);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="eyebrow-line">Mimarlığın Evrimi Quiz</p>
            <h1 className="headline mt-4 text-[2.25rem] sm:text-5xl lg:text-6xl">Liderlik tablosu</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span className="inline-flex items-center gap-2" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${stale ? "bg-white/30" : board.open ? "animate-pulse bg-[#6fcf8f]" : "bg-copper"}`} aria-hidden />
              {stale ? "Bağlantı bekleniyor" : board.open ? "Quiz açık · canlı" : "Quiz kapalı"}
            </span>
            <span className="tabular-nums">{board.finished} katılımcı</span>
          </div>
        </div>

        <p className="mt-5 max-w-xl text-[15px] text-white/65">
          Sıralama önce doğru sayısına, eşitlikte süreye göre yapılır. İlk {QUIZ_PRIZE_COUNT} kişi hediye kazanır.
        </p>

        {board.entries.length === 0 ? (
          <p className="mt-12 rounded-[4px] border border-dashed border-white/15 px-6 py-14 text-center text-white/60">
            Henüz quizi tamamlayan yok. İlk sırada siz olun.
          </p>
        ) : (
          <div className="mt-9">
            <div className="hidden grid-cols-[4rem_1fr_7rem_7rem] gap-4 px-5 pb-3 text-xs uppercase tracking-[0.08em] text-white/45 sm:grid">
              <span>Sıra</span>
              <span>Katılımcı</span>
              <span className="text-right">Doğru</span>
              <span className="text-right">Süre</span>
            </div>
            <div className="rounded-[4px] border border-copper/35">
              <p className="flex items-center justify-between border-b border-copper/35 bg-copper/10 px-3 py-2 text-xs uppercase tracking-[0.1em] text-copper sm:px-5">
                <span>Hediye kazananlar</span>
                <span className="tabular-nums">İlk {QUIZ_PRIZE_COUNT}</span>
              </p>
              <ol aria-label={`İlk ${QUIZ_PRIZE_COUNT}`}>
                {prize.map((e) => (
                  <Row key={e.rank} e={e} prize />
                ))}
              </ol>
            </div>
            {rest.length > 0 && (
              <ol aria-label="Diğer katılımcılar" className="mt-4">
                {rest.map((e) => (
                  <Row key={e.rank} e={e} prize={false} />
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

    </section>
  );
}
