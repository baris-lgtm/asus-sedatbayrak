import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaff } from "@/lib/auth";
import { extractTokenFromScan, normalizeManualCode, sha256Hex } from "@/lib/server/invitation-token";
import { hashKey, rateLimit } from "@/lib/rate-limit";
import type { CheckInResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  mode: z.enum(["qr", "code"]),
  value: z.string().min(1).max(2048),
});

/**
 * Check-in. Token/kod sunucuda hash'lenir ve atomik check_in() fonksiyonu
 * personelin kendi oturumuyla çağrılır → ilk geçerli okutma kaydedilir,
 * sonrakiler "already" döner; ilk kayıt değişmez.
 */
export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireStaff();
  } catch (e) {
    const r = authErrorResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }

  // Manuel kodun kaba kuvvetle denenmesine karşı personel başına limit.
  if (!(await rateLimit(hashKey("checkin", staff.userId), 120, 60))) {
    return NextResponse.json({ error: "Çok hızlı deneme yapıldı. Biraz bekle." }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  let args: { p_qr_token_hash: string | null; p_manual_code_hash: string | null };
  if (parsed.data.mode === "qr") {
    const token = extractTokenFromScan(parsed.data.value);
    if (!token) return NextResponse.json({ result: "invalid" } satisfies CheckInResult);
    args = { p_qr_token_hash: sha256Hex(token), p_manual_code_hash: null };
  } else {
    const code = normalizeManualCode(parsed.data.value);
    if (!code) return NextResponse.json({ result: "invalid" } satisfies CheckInResult);
    args = { p_qr_token_hash: null, p_manual_code_hash: sha256Hex(code) };
  }

  const { data, error } = await staff.supabase.rpc("check_in", args);
  if (error) {
    console.error("[check-in] hata:", error.code);
    return NextResponse.json({ error: "Kontrol yapılamadı. Tekrar dene.", code: "transient" }, { status: 503 });
  }
  return NextResponse.json(data as CheckInResult, { headers: { "Cache-Control": "no-store" } });
}
