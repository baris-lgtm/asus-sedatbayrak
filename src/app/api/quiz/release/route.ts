import { NextResponse, type NextRequest } from "next/server";
import { QUIZ_COOKIE, sameOrigin } from "@/lib/server/quiz";

export const runtime = "nodejs";

/**
 * Quiz etkinlik alanındaki ortak cihazlarda oynanır: bitiren katılımcıdan sonra
 * cihazın deneme çerezini siler, böylece sıradaki kişi yeni deneme açabilir.
 * Deneme kaydı ve sonucu veritabanında kalır.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(QUIZ_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}
