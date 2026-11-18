import { NextResponse, type NextRequest } from "next/server";
import { publicQuestions } from "@/content/quiz";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";
import { dbErrorCode } from "@/lib/db-errors";
import { normalizeQuizName } from "@/lib/quiz-format";
import { QUIZ_COOKIE, attemptToken, currentAttempt, resultOf, sameOrigin } from "@/lib/server/quiz";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Quiz denemesi başlatır. Bu cihazda (çerez) zaten bir deneme varsa yenisini
 * açmaz: yarım kalan devam eder, bitmiş olanın sonucu döner.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return json(403, { code: "forbidden", message: "Geçersiz istek kaynağı." });
    const raw = await req.text();
    if (raw.length > 2048) return json(413, { code: "too_large", message: "İstek çok büyük." });
    let body: { fullName?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { code: "bad_json", message: "İstek okunamadı." });
    }

    const existing = await currentAttempt();
    if (existing?.finished_at) {
      return json(200, { status: "finished", fullName: existing.full_name, result: await resultOf(existing) });
    }
    if (existing) {
      return json(200, {
        status: "in_progress",
        attemptId: existing.id,
        fullName: existing.full_name,
        startedAt: existing.started_at,
        serverNow: new Date().toISOString(),
        questions: publicQuestions(),
      });
    }

    const name = normalizeQuizName(typeof body.fullName === "string" ? body.fullName : "");
    if (!name) return json(422, { code: "validation", message: "Lütfen adınızı ve soyadınızı yazın." });

    // Etkinlik Wi-Fi'ında herkes aynı IP'den çıkabilir; sınır cömert tutulur.
    if (!(await rateLimit(hashKey("quiz-start-ip", await clientIp()), 400, 600))) {
      return json(429, { code: "rate_limited", message: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." });
    }

    const { data, error } = await createAdminClient().rpc("quiz_start", { p_full_name: name }).single<{ attempt_id: string; started_at: string }>();
    if (error) {
      if (dbErrorCode(error) === "ERR_QUIZ_CLOSED") return json(409, { code: "closed", message: "Quiz şu anda kapalı." });
      console.error("[quiz] başlatılamadı:", error.code);
      return json(500, { code: "server", message: "Quiz başlatılamadı. Lütfen tekrar deneyin." });
    }

    const res = json(201, {
      status: "in_progress",
      attemptId: data.attempt_id,
      fullName: name,
      startedAt: data.started_at,
      serverNow: new Date().toISOString(),
      questions: publicQuestions(),
    });
    res.cookies.set(QUIZ_COOKIE, attemptToken(data.attempt_id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 3,
    });
    return res;
  } catch {
    console.error("[quiz] başlatma hatası");
    return json(500, { code: "server", message: "Quiz başlatılamadı. Lütfen tekrar deneyin." });
  }
}
