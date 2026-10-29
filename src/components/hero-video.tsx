"use client";

import { useRef, useState } from "react";
import type { ImageSlot as Slot } from "@/config/event";
import { ImageSlot } from "@/components/image-slot";
import { PlayIcon } from "@/components/brand";

/**
 * Tanıtım videosu. Video dosyası yoksa yalnızca poster görünür (oynatma düğmesi çıkmaz).
 * Video otomatik oynatılmaz; ziyaretçi oynat'a basınca yerel kontrollerle açılır.
 */
export function HeroVideo({
  src,
  poster,
  caption,
  className = "",
  sizes = "60vw",
}: {
  src: string | null;
  poster: Slot;
  caption?: string;
  className?: string;
  sizes?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!src) {
    return (
      <div className={`relative ${className}`}>
        <ImageSlot slot={poster} dark rounded={false} priority sizes={sizes} className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video
        ref={ref}
        src={src}
        poster={poster.src ?? undefined}
        controls={playing}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        aria-label={caption ?? poster.alt}
      />
      {!playing && (
        <>
          <button
            type="button"
            onClick={() => void ref.current?.play()}
            className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-transform hover:scale-105"
            aria-label={`Videoyu oynat${caption ? `: ${caption}` : ""}`}
          >
            <PlayIcon className="ml-1 h-6 w-6" />
          </button>
          {caption && (
            <p className="pointer-events-none absolute bottom-5 right-6 max-w-[16rem] text-right text-xs leading-snug text-white/85">
              {caption}
            </p>
          )}
        </>
      )}
    </div>
  );
}
