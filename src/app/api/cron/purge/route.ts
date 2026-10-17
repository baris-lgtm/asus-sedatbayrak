import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/server/invitation-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Veri saklama süresi dolan başvuruları siler (event_settings.retention_days).
 * Vercel Cron, CRON_SECRET'ı "Authorization: Bearer <secret>" olarak gönderir.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("purge_expired_applications");
  if (error) return NextResponse.json({ error: "Silme başarısız." }, { status: 500 });
  return NextResponse.json({ deleted: data });
}
