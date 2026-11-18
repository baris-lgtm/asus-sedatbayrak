import { NextResponse } from "next/server";
import { loadLeaderboard } from "@/lib/server/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liderlik tablosu (maskeli adlar). Ekranlar birkaç saniyede bir yoklar; CDN
 * yanıtı 3 sn paylaşır, böylece yüzlerce telefon veritabanını yormaz.
 */
export async function GET() {
  try {
    const data = await loadLeaderboard(100);
    return NextResponse.json(
      { ...data, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10" } },
    );
  } catch {
    console.error("[quiz] liderlik okunamadı");
    return NextResponse.json({ code: "server" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
