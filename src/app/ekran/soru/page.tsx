import type { Metadata } from "next";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";
import { LedScreen } from "./led-screen";

export const metadata: Metadata = { title: "Sahneye Soru Sor — LED", robots: { index: false, follow: false } };

/**
 * LED ekran sayfası: ProArt P16 videosu arka planda döngüde, üstünde "Sahneye Soru Sor" QR'ı.
 * Ekran oranına göre 16:9 / 9:16 / 1:1 video seçilir (?oran=16x9|9x16|1x1 ile zorlanabilir).
 */
export default async function LedQuestionScreen() {
  const url = `${siteUrl()}/soru`;
  // LED'de güvenli okunma: beyaz zemin, siyah modül, sessiz alan, yüksek hata düzeltme
  const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  return <LedScreen qrSvg={qr} shortUrl={url.replace(/^https?:\/\/(www\.)?/, "")} />;
}
