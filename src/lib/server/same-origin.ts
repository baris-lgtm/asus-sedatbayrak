import "server-only";
import type { NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";

/** Herkese açık POST rotaları yalnızca sitenin kendi sayfalarından çağrılabilir. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).host;
    return o === req.nextUrl.host || o === new URL(siteUrl()).host;
  } catch {
    return false;
  }
}
