import { NextResponse, type NextRequest } from "next/server";
import { applicationSchema, flattenErrors } from "@/lib/validation/application";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventSettings } from "@/lib/event-settings";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";
import { sendApplicationReceived } from "@/lib/email/notifications";
import { verifyTurnstile } from "@/lib/turnstile";
import { dbErrorCode } from "@/lib/db-errors";
import { eventContent } from "@/config/event";
import { siteUrl, ConfigError } from "@/lib/env";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).host;
    return o === req.nextUrl.host || o === new URL(siteUrl()).host;
  } catch {
    return false;
  }
}

/**
 * Başvuru kaydı. Sıra: köken → boyut → honeypot → rate limit → CAPTCHA →
 * doğrulama → kayıt (DB tetikleyicisi durumu daima 'pending' yapar) → e-posta.
 * E-posta başarısız olsa bile başvuru kaydı korunur ve 201 döner.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return json(403, { code: "forbidden", message: "Geçersiz istek kaynağı." });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { code: "too_large", message: "Form verisi çok büyük." });

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { code: "bad_json", message: "Form verisi okunamadı." });
    }

    // Honeypot dolu → bot. Bilgi vermemek için başarılı gibi yanıtla, kaydetme.
    if (body && typeof body === "object" && typeof (body as { website?: unknown }).website === "string" && (body as { website: string }).website.length > 0) {
      return json(201, { ok: true });
    }

    const ip = await clientIp();
    if (!(await rateLimit(hashKey("apply-ip", ip), 20, 600))) {
      return json(429, { code: "rate_limited", message: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene." });
    }

    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return json(422, { code: "validation", message: "Formdaki hataları düzelt.", fieldErrors: flattenErrors(parsed.error) });
    }
    const input = parsed.data;

    if (!(await rateLimit(hashKey("apply-email", input.email), 3, 3600))) {
      return json(429, { code: "rate_limited", message: "Bu e-posta adresiyle çok fazla deneme yapıldı. Lütfen daha sonra tekrar dene." });
    }

    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return json(400, { code: "captcha", message: "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar dene." });
    }

    const settings = await getEventSettings();
    if (!settings.applications_open) {
      return json(403, { code: "closed", message: "Başvurular şu anda kapalı." });
    }

    const additional: Record<string, string> = {};
    if (eventContent.additionalQuestion && input.motivation) additional[eventContent.additionalQuestion.id] = input.motivation;

    const db = createAdminClient();
    const { data, error } = await db
      .from("applications")
      .insert({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        participant_type: input.participantType,
        institution: input.institution,
        department: input.department,
        additional_answers: additional,
        kvkk_notice_version: settings.kvkk_notice_version,
        marketing_consent: input.marketingConsent === true,
        marketing_consent_version: input.marketingConsent ? settings.marketing_consent_version : null,
      })
      .select("id, first_name, email")
      .single<{ id: string; first_name: string; email: string }>();

    if (error) {
      if (error.code === "23505") {
        return json(409, {
          code: "duplicate",
          message: "Bu e-posta adresiyle daha önce başvuru yapılmış. Başvurunun sonucu bu adrese e-postayla bildirilecek.",
        });
      }
      if (dbErrorCode(error) === "ERR_APPLICATIONS_CLOSED") {
        return json(403, { code: "closed", message: "Başvurular şu anda kapalı." });
      }
      if (error.code === "23514") {
        return json(422, { code: "validation", message: "Formdaki bilgileri kontrol et." });
      }
      console.error("[apply] kayıt hatası:", error.code);
      return json(500, { code: "server", message: "Başvurun kaydedilemedi. Lütfen tekrar dene." });
    }

    // E-posta hatası başvuruyu etkilemez (email_logs'ta 'failed' olarak görünür).
    await sendApplicationReceived(data).catch(() => console.error("[apply] alındı e-postası istisnası"));

    return json(201, { ok: true });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error("[apply] yapılandırma eksik:", e.variable);
      return json(503, { code: "config", message: "Başvuru sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar dene." });
    }
    console.error("[apply] beklenmeyen hata");
    return json(500, { code: "server", message: "Başvurun kaydedilemedi. Lütfen tekrar dene." });
  }
}
