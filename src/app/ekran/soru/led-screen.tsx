"use client";

import { useEffect, useState } from "react";

type Ratio = "16x9" | "9x16" | "1x1";
const VIDEOS: Record<Ratio, { src: string; poster: string }> = {
  "16x9": { src: "/media/proart-p16-led-16x9-v1.mp4", poster: "/images/proart-p16-led-16x9-poster-v1.jpg" },
  "9x16": { src: "/media/proart-p16-led-9x16-v1.mp4", poster: "/images/proart-p16-led-9x16-poster-v1.jpg" },
  "1x1": { src: "/media/proart-p16-led-1x1-v1.mp4", poster: "/images/proart-p16-led-1x1-poster-v1.jpg" },
};

function pickRatio(): Ratio {
  const forced = new URLSearchParams(window.location.search).get("oran");
  if (forced === "16x9" || forced === "9x16" || forced === "1x1") return forced;
  const r = window.innerWidth / window.innerHeight;
  return r > 1.3 ? "16x9" : r < 0.77 ? "9x16" : "1x1";
}

export function LedScreen({ qrSvg, shortUrl }: { qrSvg?: string; shortUrl?: string }) {
  const [ratio, setRatio] = useState<Ratio>("16x9");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => setRatio(pickRatio());
    update();
    setReady(true);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const v = VIDEOS[ratio];
  const portrait = ratio === "9x16";

  return (
    <div
      className="fixed inset-0 cursor-none overflow-hidden bg-black font-headline text-white select-none"
      onDoubleClick={() => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined);
        else document.exitFullscreen?.().catch(() => undefined);
      }}
    >
      {ready && (
        <video
          key={v.src}
          className="absolute inset-0 h-full w-full object-cover"
          src={v.src}
          poster={v.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        />
      )}

      {qrSvg && (
      <div
        className={`absolute flex flex-col items-center rounded-[1.2vmin] bg-black/75 text-center shadow-[0_2vmin_6vmin_rgba(0,0,0,0.55)] ring-1 ring-white/15 backdrop-blur-md ${
          portrait ? "right-[4vmin] top-[4vmin] p-[2.4vmin]" : "right-[4.5vmin] top-[4.5vmin] p-[2.4vmin]"
        }`}
        style={{ width: portrait ? "40vmin" : ratio === "1x1" ? "36vmin" : "30vmin" }}
      >
        <p className="font-semibold leading-tight" style={{ fontSize: portrait ? "4.4vmin" : "3vmin" }}>
          Sahneye Soru Sor
        </p>
        <div className="mt-[1.6vmin] w-full overflow-hidden rounded-[0.8vmin] bg-white" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-[1.4vmin] leading-snug text-white/85" style={{ fontSize: portrait ? "2.6vmin" : "1.7vmin" }}>
          QR&apos;ı okutun, sorunuzu gönderin
        </p>
        <p className="mt-[0.6vmin] font-medium text-[#d4a373]" style={{ fontSize: portrait ? "2.4vmin" : "1.6vmin" }}>
          {shortUrl}
        </p>
      </div>
      )}
    </div>
  );
}
