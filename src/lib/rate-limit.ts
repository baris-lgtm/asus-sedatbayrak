import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** İstemci IP'si (Vercel x-forwarded-for'un ilk değerini güvenilir biçimde ayarlar). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/** Ham IP/e-posta saklanmaz; tuzlanmış HMAC'i anahtar olarak kullanılır. */
export function hashKey(purpose: string, value: string): string {
  const salt = process.env.RATE_LIMIT_SALT || process.env.INVITATION_TOKEN_SECRET || "dev-salt";
  return `${purpose}:${createHmac("sha256", salt).update(value.toLowerCase()).digest("base64url").slice(0, 32)}`;
}

/**
 * Veritabanı tabanlı sabit pencere rate limit (serverless örnekleri arasında
 * paylaşılır). true → izin ver. Veritabanı hatasında güvenli tarafta kalıp
 * isteğe izin verir ama hatayı loglar (başvuruların tamamen durmaması için).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] kontrol başarısız:", error.code);
    return true;
  }
  return data === true;
}
