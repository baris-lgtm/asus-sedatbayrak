import type { Metadata } from "next";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";
import { FullscreenToggle } from "./fullscreen-toggle";

export const metadata: Metadata = { title: "Oturum — LED", robots: { index: false, follow: false } };

/** LED: Sedat Bayrak × Ömer Selçuk Baz oturum görseli + sağ üstte "Sahneye Soru Sor" QR. 16:9 tuvale sığar. */
export default async function SessionScreen() {
  const url = `${siteUrl()}/soru`;
  const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  return (
    <FullscreenToggle>
      <div className="fixed inset-0 flex cursor-none items-center justify-center bg-black font-headline text-white select-none">
        <div className="relative aspect-video w-[min(100vw,calc(100vh*16/9))]" style={{ containerType: "inline-size" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/oturum-sedat-omer-v1.jpg" alt="Sedat Bayrak × Ömer Selçuk Baz — Mimari Tasarım ve Üretim Süreçleri" className="absolute inset-0 h-full w-full" />
          <div
            className="absolute flex flex-col items-center text-center"
            style={{ right: "2.6cqw", top: "2cqw", width: "9.2cqw", padding: "0.75cqw", borderRadius: "0.5cqw", background: "rgba(0,0,0,0.55)", boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}
          >
            <p className="whitespace-nowrap font-semibold leading-tight" style={{ fontSize: "0.9cqw" }}>
              Sahneye Soru Sor
            </p>
            <div className="w-full overflow-hidden bg-white" style={{ marginTop: "0.5cqw", borderRadius: "0.3cqw" }} dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="font-medium text-[#d4a373]" style={{ marginTop: "0.45cqw", fontSize: "0.68cqw" }}>
              {url.replace(/^https?:\/\/(www\.)?/, "")}
            </p>
          </div>
        </div>
      </div>
    </FullscreenToggle>
  );
}
