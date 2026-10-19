"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Yönetim panelinde beklenmeyen hata (geçici bağlantı sorunu, veritabanı
 * yanıt vermedi vb.). Beyaz sayfa yerine anlaşılır mesaj + tekrar dene
 * (retry() sunucudan veriyi yeniden çeker; reset() çekmez).
 * Üst menü (layout) görünür kalır.
 */
export default function PanelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[admin] sayfa hatası", error.digest ?? "");
  }, [error]);

  return (
    <div role="alert" className="max-w-xl border-2 border-ink bg-paper p-6">
      <h1 className="display text-3xl">Sayfa yüklenemedi</h1>
      <p className="mt-3 leading-relaxed">
        Sunucuya veya veritabanına şu an ulaşılamıyor olabilir. Yaptığın son işlem kaydedilmiş olabilir; tekrar denemeden
        önce sayfayı yenileyip durumu kontrol et.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Tekrar dene
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          Sayfayı yenile
        </button>
        <Link href="/admin/check-in" className="btn btn-secondary">
          Check-in ekranı
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-graphite">Hata kodu: {error.digest}</p>}
    </div>
  );
}
