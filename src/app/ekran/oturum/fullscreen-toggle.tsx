"use client";

/** Çift tıkla tam ekran aç/kapat. */
export function FullscreenToggle({ children }: { children: React.ReactNode }) {
  return (
    <div
      onDoubleClick={() => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined);
        else document.exitFullscreen?.().catch(() => undefined);
      }}
    >
      {children}
    </div>
  );
}
