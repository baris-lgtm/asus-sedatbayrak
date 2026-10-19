"use client";

/** Kök düzeyde beklenmeyen hata (layout dahil). Kendi <html>/<body> etiketlerini içermek zorundadır. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "48px 16px", background: "#fff", color: "#000" }}>
        <main style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Bir şeyler ters gitti</h1>
          <p style={{ lineHeight: 1.6 }}>Sayfa yüklenemedi. Bağlantını kontrol edip tekrar dene.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, minHeight: 48, padding: "0 24px", background: "#000", color: "#fff", border: 0, fontWeight: 700, fontSize: 16 }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
