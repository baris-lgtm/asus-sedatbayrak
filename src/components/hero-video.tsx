"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ImageSlot as Slot } from "@/config/event";
import { ImageSlot } from "@/components/image-slot";
import { PlayIcon } from "@/components/brand";

function PauseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <rect x="5" y="4" width="3.2" height="12" rx="0.8" fill="currentColor" />
      <rect x="11.8" y="4" width="3.2" height="12" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function ReplayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M4.5 10a5.5 5.5 0 1 0 1.7-3.98M4.5 3.5v3.2h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Açılış arka plan videosu: sessiz, bir kez oynar ve son karede durur (son kare = poster görseli).
 * "Hareketi azalt" tercihi olan ziyaretçilere ve video yüklenemezse yalnızca poster gösterilir.
 * Duraklat / tekrar oynat düğmesi her zaman erişilebilir (WCAG 2.2.2).
 */
export function BackgroundVideo({
  src,
  poster,
  caption,
  className = "",
  sizes = "100vw",
}: {
  src: string | null;
  poster: Slot;
  caption?: string;
  className?: string;
  sizes?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"pending" | "poster" | "video">("pending");
  const [state, setState] = useState<"playing" | "paused" | "ended">("paused");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!src || reduce) {
      setMode("poster");
      return;
    }
    const v = ref.current;
    if (!v) return;
    v.play().then(
      () => setMode("video"),
      () => setMode("poster"), // otomatik oynatma engellendi → poster
    );
  }, [src]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (state === "playing") {
      v.pause();
    } else {
      if (state === "ended") v.currentTime = 0;
      setMode("video");
      void v.play();
    }
  };

  if (!src) {
    return <ImageSlot slot={poster} dark rounded={false} priority sizes={sizes} className={className} />;
  }

  const label = state === "playing" ? "Videoyu duraklat" : state === "ended" ? "Videoyu tekrar oynat" : "Videoyu oynat";

  return (
    <div className={`relative overflow-hidden bg-night ${className}`}>
      {poster.src && (
        <Image
          src={poster.src}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover object-[66%_50%] transition-opacity lg:object-right duration-700 ${mode === "poster" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        preload="auto"
        aria-hidden
        tabIndex={-1}
        className={`absolute inset-0 h-full w-full object-cover object-[66%_50%] transition-opacity lg:object-right duration-700 ${mode === "video" ? "opacity-100" : "opacity-0"}`}
        onPlay={() => setState("playing")}
        onPause={() => setState((s) => (s === "ended" ? s : "paused"))}
        onEnded={() => setState("ended")}
        onError={() => setMode("poster")}
      />
      <span className="sr-only">{poster.alt}</span>
      <div className="absolute right-4 top-4 z-20 flex items-center gap-4 sm:right-8 sm:top-6 lg:bottom-7 lg:top-auto">
        {caption && <p className="hidden max-w-[15rem] text-right text-xs leading-snug text-white/80 lg:block">{caption}</p>}
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          {state === "playing" ? <PauseIcon /> : state === "ended" ? <ReplayIcon /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Ürün videosu gibi isteğe bağlı oynatılan videolar (otomatik oynatma yok). */
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
    return <ImageSlot slot={poster} dark rounded={false} sizes={sizes} className={className} />;
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
        <button
          type="button"
          onClick={() => void ref.current?.play()}
          className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-transform hover:scale-105"
          aria-label={`Videoyu oynat${caption ? `: ${caption}` : ""}`}
        >
          <PlayIcon className="ml-1 h-6 w-6" />
        </button>
      )}
    </div>
  );
}

function SoundIcon({ muted, className = "h-4 w-4" }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M3.5 8v4h3l4 3.5v-11L6.5 8h-3Z" fill="currentColor" />
      {muted ? (
        <path d="m13.5 7.5 4 5m0-5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M13.5 7a4 4 0 0 1 0 6M15.5 5a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Ürün tanıtım videosu: görünür olunca sessiz ve döngüde oynar, ekrandan çıkınca durur.
 * Ses ve oynat/duraklat düğmeleri her zaman var. "Hareketi azalt" tercihinde otomatik oynamaz.
 */
export function ProductVideo({ src, poster, label, className = "" }: { src: string; poster: string | null; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const userPaused = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current) void v.play().catch(() => undefined);
        else if (!e.isIntersecting) v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      void v.play();
    } else {
      userPaused.current = true;
      v.pause();
    }
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) {
      userPaused.current = false;
      void v.play();
    }
  };

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={`Videoyu oynat: ${label}`}
          className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-transform hover:scale-105"
        >
          <PlayIcon className="ml-1 h-6 w-6" />
        </button>
      )}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Videoyu duraklat" : "Videoyu oynat"}
          className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/70"
        >
          {playing ? <PauseIcon /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Sesi aç" : "Sesi kapat"}
          aria-pressed={!muted}
          className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/70"
        >
          <SoundIcon muted={muted} />
        </button>
      </div>
    </div>
  );
}
