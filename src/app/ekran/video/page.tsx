import type { Metadata } from "next";
import { LedScreen } from "../soru/led-screen";

export const metadata: Metadata = { title: "ProArt P16 — LED", robots: { index: false, follow: false } };

/** LED ekran: yalnızca ProArt P16 videosu, QR yok. ?oran=16x9|9x16|1x1 ile zorlanabilir. */
export default function LedVideoScreen() {
  return <LedScreen />;
}
