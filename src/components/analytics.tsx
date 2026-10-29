"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "analytics-consent";
type Consent = "granted" | "denied" | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Analitik olayı. Kullanıcı izin vermediyse HİÇBİR şey gönderilmez.
 * Kişisel veri (ad, e-posta vb.) parametre olarak verilmemelidir.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined" || readConsent() !== "granted") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/**
 * GA4/GTM yalnızca ID tanımlıysa ve kullanıcı açıkça izin verirse yüklenir.
 * ID tanımlı değilse banner da gösterilmez (izleme yok → izin gerekmez).
 */
export function ConsentAndAnalytics({ gaId, gtmId }: { gaId?: string; gtmId?: string }) {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!gaId && !gtmId) return null;

  const choose = (value: "granted" | "denied") => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* depolama kapalıysa yalnızca bu oturum için geçerli */
    }
    setConsent(value);
  };

  return (
    <>
      {consent === "granted" && gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmId)});`}
        </Script>
      )}
      {consent === "granted" && gaId && !gtmId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {ready && consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Çerez tercihi"
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper px-4 py-4 sm:px-8"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed">
              Siteyi geliştirmek için anonim kullanım istatistikleri toplamak istiyoruz. Bu çerezler yalnızca izin
              verirseniz etkinleşir. <Link href="/gizlilik" className="underline underline-offset-2">Gizlilik Politikası</Link>
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => choose("denied")}>
                Reddet
              </button>
              <button type="button" className="btn btn-primary" onClick={() => choose("granted")}>
                İzin ver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
