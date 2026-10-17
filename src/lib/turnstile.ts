import "server-only";
import { turnstileEnabled } from "@/lib/env";

/**
 * Cloudflare Turnstile doğrulaması. Anahtarlar tanımlı değilse CAPTCHA kapalıdır
 * (rate limit + honeypot yine çalışır) ve true döner.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY as string,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    console.error("[turnstile] doğrulama isteği başarısız");
    return false;
  }
}
