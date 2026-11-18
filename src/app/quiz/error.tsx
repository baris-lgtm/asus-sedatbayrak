"use client";

/** retry() sunucudan veriyi yeniden çeker (reset() çekmez). */
export default function QuizError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-night px-6 text-center font-headline text-white">
      <h1 className="headline text-2xl">Bağlantı kurulamadı</h1>
      <p className="max-w-sm text-sm text-white/70">İnternet bağlantınızı kontrol edip tekrar deneyin. Cevaplarınız bu cihazda saklanıyor.</p>
      <button type="button" onClick={() => retry()} className="btn-copper">
        Tekrar dene
      </button>
    </div>
  );
}
