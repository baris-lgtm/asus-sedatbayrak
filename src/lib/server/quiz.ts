import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { quizQuestions } from "@/content/quiz";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/env";
export { sameOrigin } from "@/lib/server/same-origin";
import { maskName } from "@/lib/quiz-format";

/** Bu cihazın quiz denemesi: "<attempt uuid>.<hmac>" — httpOnly çerez. */
export const QUIZ_COOKIE = "quiz_attempt";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sign(attemptId: string): string {
  return createHmac("sha256", requireEnv("INVITATION_TOKEN_SECRET")).update(`quiz:${attemptId}`).digest("base64url");
}

export function attemptToken(attemptId: string): string {
  return `${attemptId}.${sign(attemptId)}`;
}

/** Geçerli imzalı token ise deneme id'sini, değilse null döner. */
export function verifyAttemptToken(token: string | undefined | null): string | null {
  if (!token || token.length > 120) return null;
  const [id, mac] = token.split(".");
  if (!id || !mac || !UUID_RE.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export interface ScoredAnswer {
  q: string;
  chosen: number | null;
  correct: boolean;
}

/** Cevapları sunucudaki anahtarla puanlar. answers[i] = i. sorunun seçilen şık indeksi ya da null. */
export function scoreAnswers(answers: unknown): { correct: number; total: number; detail: ScoredAnswer[] } | null {
  if (!Array.isArray(answers) || answers.length !== quizQuestions.length) return null;
  const detail: ScoredAnswer[] = [];
  for (const [i, q] of quizQuestions.entries()) {
    const a = answers[i];
    if (a !== null && !(Number.isInteger(a) && a >= 0 && a <= 3)) return null;
    detail.push({ q: q.id, chosen: a, correct: a === q.answer });
  }
  return { correct: detail.filter((d) => d.correct).length, total: quizQuestions.length, detail };
}


export interface QuizResult {
  correct: number;
  total: number;
  durationMs: number;
  rank: number;
}

export type QuizState =
  | { kind: "closed"; result?: QuizResult }
  | { kind: "entry" }
  | { kind: "in_progress"; attemptId: string; fullName: string; startedAt: string; serverNow: string }
  | { kind: "finished"; fullName: string; result: QuizResult };

interface AttemptRow {
  id: string;
  full_name: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  correct_count: number | null;
  total_questions: number | null;
}

export async function quizIsOpen(): Promise<boolean> {
  const { data, error } = await createAdminClient().from("quiz_settings").select("is_open").eq("id", 1).single();
  if (error) throw new Error("Quiz ayarı okunamadı");
  return Boolean(data?.is_open);
}

/** Çerezdeki denemeyi okur (imza geçersizse veya silinmişse null). */
export async function currentAttempt(): Promise<AttemptRow | null> {
  const id = verifyAttemptToken((await cookies()).get(QUIZ_COOKIE)?.value);
  if (!id) return null;
  const { data, error } = await createAdminClient()
    .from("quiz_attempts")
    .select("id, full_name, started_at, finished_at, duration_ms, correct_count, total_questions")
    .eq("id", id)
    .maybeSingle<AttemptRow>();
  if (error) throw new Error("Quiz denemesi okunamadı");
  return data;
}

export async function rankOf(attemptId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("quiz_rank_of", { p_attempt: attemptId });
  if (error) throw new Error("Sıra okunamadı");
  return Number(data);
}

export async function resultOf(row: AttemptRow): Promise<QuizResult> {
  return {
    correct: row.correct_count ?? 0,
    total: row.total_questions ?? quizQuestions.length,
    durationMs: row.duration_ms ?? 0,
    rank: await rankOf(row.id),
  };
}

export async function loadQuizState(): Promise<QuizState> {
  const [open, attempt] = await Promise.all([quizIsOpen(), currentAttempt()]);
  if (attempt?.finished_at) {
    const result = await resultOf(attempt);
    return { kind: "finished", fullName: attempt.full_name, result };
  }
  if (!open) return { kind: "closed" };
  if (attempt) {
    return {
      kind: "in_progress",
      attemptId: attempt.id,
      fullName: attempt.full_name,
      startedAt: attempt.started_at,
      serverNow: new Date().toISOString(),
    };
  }
  return { kind: "entry" };
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  correct: number;
  total: number;
  durationMs: number;
}

/** Herkese açık liderlik: adlar maskeli (ad + soyadın baş harfi). */
export async function loadLeaderboard(limit = 100): Promise<{ open: boolean; finished: number; entries: LeaderboardEntry[] }> {
  const db = createAdminClient();
  const [open, board, count] = await Promise.all([
    quizIsOpen(),
    db.rpc("quiz_leaderboard", { p_limit: limit }),
    db.from("quiz_attempts").select("id", { count: "exact", head: true }).not("finished_at", "is", null),
  ]);
  if (board.error || count.error) throw new Error("Liderlik okunamadı");
  const rows = (board.data ?? []) as { rank: number; full_name: string; correct_count: number; total_questions: number; duration_ms: number }[];
  return {
    open,
    finished: count.count ?? rows.length,
    entries: rows.map((r) => ({
      rank: r.rank,
      name: maskName(r.full_name),
      correct: r.correct_count,
      total: r.total_questions,
      durationMs: r.duration_ms,
    })),
  };
}
