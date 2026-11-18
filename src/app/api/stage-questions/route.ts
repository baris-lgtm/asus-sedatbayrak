import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";
import { dbErrorCode } from "@/lib/db-errors";
import { sameOrigin } from "@/lib/server/same-origin";
import { stageQuestionSchema } from "@/lib/validation/stage-question";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** "Sahneye Soru Sor" gönderimi. Sıra: köken → boyut → honeypot → rate limit → doğrulama → kayıt. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return json(403, { code: "forbidden", message: "Geçersiz istek kaynağı." });
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { code: "too_large", message: "Soru çok uzun." });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { code: "bad_json", message: "Form okunamadı." });
    }
    if (body && typeof body === "object" && typeof (body as { website?: unknown }).website === "string" && (body as { website: string }).website) {
      return json(201, { ok: true });
    }

    // Salonda herkes aynı Wi-Fi IP'sinden çıkabilir; sınır cömert, kötüye kullanımı yine de keser.
    if (!(await rateLimit(hashKey("stage-ip", await clientIp()), 120, 600))) {
      return json(429, { code: "rate_limited", message: "Çok fazla soru gönderildi. Lütfen birkaç dakika sonra tekrar deneyin." });
    }

    const parsed = stageQuestionSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return json(422, { code: "validation", field: String(first?.path[0] ?? ""), message: first?.message ?? "Formu kontrol edin." });
    }

    const { error } = await createAdminClient().rpc("stage_submit", { p_name: parsed.data.name ?? null, p_body: parsed.data.question });
    if (error) {
      if (dbErrorCode(error) === "ERR_STAGE_CLOSED") return json(409, { code: "closed", message: "Soru alımı şu anda kapalı." });
      console.error("[stage] kaydedilemedi:", error.code);
      return json(500, { code: "server", message: "Sorunuz gönderilemedi. Lütfen tekrar deneyin." });
    }
    return json(201, { ok: true });
  } catch {
    console.error("[stage] gönderim hatası");
    return json(500, { code: "server", message: "Sorunuz gönderilemedi. Lütfen tekrar deneyin." });
  }
}
