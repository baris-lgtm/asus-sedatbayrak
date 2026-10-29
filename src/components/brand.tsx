/* eslint-disable @next/next/no-img-element -- logolar SVG; boyutları CSS ile verilir */
import { eventContent } from "@/config/event";

/**
 * Logo kilidi. Resmi logo dosyaları `eventContent.logos` altında tanımlanınca onlar,
 * tanımlanmadıysa düz yazı gösterilir (logolar elle çizilmez).
 */
export function BrandMark({ className = "" }: { className?: string }) {
  const src = eventContent.logos.brand;
  return src ? (
    <img src={src} alt={eventContent.brand} className={`h-[1.1em] w-auto ${className}`} />
  ) : (
    <span className={`font-sans font-semibold tracking-[0.14em] ${className}`}>{eventContent.brand}</span>
  );
}

export function ArtistMark({ className = "" }: { className?: string }) {
  const src = eventContent.logos.artist;
  return src ? (
    <img src={src} alt={eventContent.artist} className={`h-[1.1em] w-auto ${className}`} />
  ) : (
    <span className={`font-serif tracking-[-0.01em] ${className}`}>{eventContent.artist}</span>
  );
}

/** "ProArt | DESIGN FUTURES" alt marka kilidi (logo dosyası yoksa yazı). */
export function ProgramMark({ className = "" }: { className?: string }) {
  const src = eventContent.logos.program;
  if (src) return <img src={src} alt={`${eventContent.program.name} ${eventContent.program.sub}`} className={`h-[1.4em] w-auto ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {eventContent.logos.proart ? (
        <img src={eventContent.logos.proart} alt={eventContent.program.name} className="h-[1.25em] w-auto" />
      ) : (
        <span className="font-headline text-[1.45em] font-medium tracking-[-0.01em] text-copper">{eventContent.program.name}</span>
      )}
      <span aria-hidden className="h-[1.2em] w-px bg-white/45" />
      <span lang="en" className="text-[0.82em] font-medium uppercase tracking-[0.08em] text-white/90">{eventContent.program.sub}</span>
    </span>
  );
}

export function PlayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <path d="M6.5 4.2v11.6a.6.6 0 0 0 .92.5l9.06-5.8a.6.6 0 0 0 0-1L7.42 3.7a.6.6 0 0 0-.92.5Z" fill="currentColor" />
    </svg>
  );
}

export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark />
      <span aria-hidden className="text-[0.8em] font-light text-graphite">
        ×
      </span>
      <ArtistMark />
    </span>
  );
}

export function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <rect x="2.75" y="4" width="14.5" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.75 8h14.5M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M10 17.5s5.5-4.9 5.5-9.25a5.5 5.5 0 1 0-11 0C4.5 12.6 10 17.5 10 17.5Z" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10" cy="8.25" r="1.9" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
