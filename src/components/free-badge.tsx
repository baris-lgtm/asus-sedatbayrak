/** "Katılım Ücretsizdir" rozeti — açılış görselinin sağ üstünde, bakır yıldız şeklinde. */
const STAR =
  "50.0,0.0 58.1,9.3 69.1,3.8 73.1,15.5 85.4,14.6 84.5,26.9 96.2,30.9 90.7,41.9 100.0,50.0 90.7,58.1 96.2,69.1 84.5,73.1 85.4,85.4 73.1,84.5 69.1,96.2 58.1,90.7 50.0,100.0 41.9,90.7 30.9,96.2 26.9,84.5 14.6,85.4 15.5,73.1 3.8,69.1 9.3,58.1 0.0,50.0 9.3,41.9 3.8,30.9 15.5,26.9 14.6,14.6 26.9,15.5 30.9,3.8 41.9,9.3";

export function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`badge-pop pointer-events-none select-none ${className}`}>
      <div className="relative aspect-square w-full -rotate-[9deg] drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 h-full w-full">
          <polygon points={STAR} fill="#d4a373" />
        </svg>
        <p className="absolute inset-0 flex flex-col items-center justify-center text-center font-headline font-semibold leading-[1.02] tracking-[-0.01em] text-[#17120c]">
          <span className="text-[0.92em]">Katılım</span>
          <span>Ücretsizdir</span>
          <svg viewBox="0 0 60 8" aria-hidden className="mt-[0.18em] w-[62%]">
            <path d="M2 6 Q 30 1 58 4" fill="none" stroke="#17120c" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </p>
      </div>
    </div>
  );
}
