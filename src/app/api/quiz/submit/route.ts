import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";
import { dbErrorCode } from "@/lib/db-errors";
import { currentAttempt, resultOf, sameOrigin, scoreAnswers } from "@/lib/server/quiz";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Cevapları sunucuda puanlar; süre veritabanı saatinden hesaplanır.
 * Deneme çerezden okunur ve yalnızca bir kez tamamlanabilir.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return json(403, { code: "forbidden", message: "Geçersiz istek kaynağı." });
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { code: "too_large", message: "İstek çok büyük." });
    let body: { answers?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { code: "bad_json", message: "İstek okunamadı." });
    }

    if (!(await rateLimit(hashKey("quiz-submit-ip", await clientIp()), 600, 600))) {
      return json(429, { code: "rate_limited", message: "Çok fazla istek. Birkaç saniye sonra tekrar deneyin." });
    }

    const attempt = await currentAttempt();
    if (!attempt) return json(404, { code: "no_attempt", message: "Quiz denemeniz bulunamadı. Sayfayı yenileyip yeniden başlayın." });
    if (attempt.finished_at) {
      return json(200, { status: "finished", fullName: attempt.full_name, result: await resultOf(attempt), already: true });
    }

    const scored = scoreAnswers(body.answers);
    if (!scored) return json(422, { code: "validation", message: "Cevaplar okunamadı. Sayfayı yenileyip tekrar deneyin." });

    const { data, error } = await createAdminClient()
      .rpc("quiz_finish", { p_attempt: attempt.id, p_correct: scored.correct, p_total: scored.total, p_answers: scored.detail })
      .single<{ duration_ms: number; correct_count: number; total_questions: number; rank: number; already: boolean }>();
    if (error) {
      const code = dbErrorCode(error);
      if (code === "ERR_QUIZ_CLOSED") return json(409, { code: "closed", message: "Quiz kapandı; cevaplarınız kaydedilemedi." });
      if (code === "ERR_NOT_FOUND") return json(404, { code: "no_attempt", message: "Quiz denemeniz bulunamadı." });
      console.error("[quiz] gönderilemedi:", error.code);
      return json(500, { code: "server", message: "Cevaplar kaydedilemedi. Lütfen tekrar deneyin." });
    }
    return json(200, {
      status: "finished",
      fullName: attempt.full_name,
      result: { correct: data.correct_count, total: data.total_questions, durationMs: data.duration_ms, rank: data.rank },
      already: data.already,
    });
  } catch {
    console.error("[quiz] gönderim hatası");
    return json(500, { code: "server", message: "Cevaplar kaydedilemedi. Lütfen tekrar deneyin." });
  }
}
