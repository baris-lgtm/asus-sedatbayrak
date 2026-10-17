"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import type { CheckInResult } from "@/lib/types";
import { PARTICIPANT_LABELS } from "@/lib/types";

type Camera = { kind: "off" } | { kind: "starting" } | { kind: "on" } | { kind: "error"; message: string };
type Shown = CheckInResult | { result: "error"; message: string };

function timeTr(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : typeof e === "string" ? e : "";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera yalnızca güvenli (https) bağlantıda çalışır. Giriş kodunu elle girebilirsin.";
  }
  if (name === "NotAllowedError" || /permission|denied/i.test(String(e))) {
    return "Kamera izni reddedildi. Tarayıcı ayarlarından bu site için kamera iznini aç veya giriş kodunu elle gir.";
  }
  if (name === "NotFoundError" || /camera not found|no camera/i.test(String(e))) {
    return "Bu cihazda kamera bulunamadı. Giriş kodunu elle girebilirsin.";
  }
  if (name === "NotReadableError") {
    return "Kamera başka bir uygulama tarafından kullanılıyor. Diğer uygulamaları kapatıp tekrar dene.";
  }
  return "Kamera başlatılamadı. Giriş kodunu elle girebilirsin.";
}

export function CheckInScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const busyRef = useRef(false);
  const [camera, setCamera] = useState<Camera>({ kind: "off" });
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = useCallback(async (mode: "qr" | "code", value: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    try {
      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, value }),
      });
      if (res.status === 401) {
        setShown({ result: "error", message: "Oturumun sona ermiş. Sayfayı yenileyip tekrar giriş yap." });
      } else if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setShown({ result: "error", message: b.error ?? "Kontrol yapılamadı. Tekrar dene." });
      } else {
        const data = (await res.json()) as CheckInResult;
        setShown(data);
        navigator.vibrate?.(data.result === "ok" ? 80 : [60, 60, 60]);
        if (data.result === "ok") {
          setCode("");
          clearTimer.current = setTimeout(() => setShown(null), 4000);
        }
      }
    } catch {
      setShown({ result: "error", message: "Bağlantı yok. İnternet bağlantısını kontrol edip tekrar dene." });
    } finally {
      // Aynı QR'ın art arda yakalanmasını önlemek için kısa bekleme.
      setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
      }, 1500);
      resultRef.current?.focus();
    }
  }, []);

  const startCamera = async () => {
    setCamera({ kind: "starting" });
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!videoRef.current) return;
      if (!(await QrScanner.hasCamera())) throw Object.assign(new Error("no camera"), { name: "NotFoundError" });
      scannerRef.current?.destroy();
      const scanner = new QrScanner(videoRef.current, (r) => void submit("qr", r.data), {
        preferredCamera: "environment",
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        maxScansPerSecond: 5,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCamera({ kind: "on" });
    } catch (e) {
      scannerRef.current?.destroy();
      scannerRef.current = null;
      setCamera({ kind: "error", message: cameraErrorMessage(e) });
    }
  };

  const stopCamera = () => {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamera({ kind: "off" });
  };

  useEffect(() => () => scannerRef.current?.destroy(), []);

  const panel = shown && (() => {
    switch (shown.result) {
      case "ok":
        return { tone: "bg-ok text-paper", title: "Giriş onaylandı", body: `${shown.first_name} ${shown.last_name} — ${PARTICIPANT_LABELS[shown.participant_type]}` };
      case "already":
        return { tone: "bg-amber-400 text-ink", title: "Bu katılımcının girişi daha önce yapılmış", body: `${shown.first_name} ${shown.last_name} — ilk giriş: ${timeTr(shown.checked_in_at)}. Tekrar giriş verme.` };
      case "revoked":
        return { tone: "bg-err text-paper", title: "Davetiye iptal edilmiş", body: "Bu QR kodu geçerli değil. Katılımcıyı kayıt masasına yönlendir." };
      case "not_approved":
        return { tone: "bg-err text-paper", title: "Onaylı katılım yok", body: "Bu davetiyeye ait başvuru onaylı değil. Kayıt masasına yönlendir." };
      case "invalid":
        return { tone: "bg-err text-paper", title: "Geçersiz kod", body: "Bu QR kodu / giriş kodu sistemde bulunamadı." };
      case "error":
        return { tone: "bg-ink text-paper", title: "Kontrol yapılamadı", body: shown.message };
    }
  })();

  return (
    <div className="mt-6 space-y-6">
      <div ref={resultRef} tabIndex={-1} aria-live="assertive" className="outline-none">
        {panel && (
          <div className={`p-5 ${panel.tone}`}>
            <p className="text-2xl font-bold leading-tight">{panel.title}</p>
            <p className="mt-2 text-lg">{panel.body}</p>
            <button type="button" onClick={() => setShown(null)} className="mt-4 border-2 border-current px-4 py-2 font-semibold">
              Sonraki katılımcı
            </button>
          </div>
        )}
      </div>

      <section aria-labelledby="kamera" className="border border-rule bg-paper p-4">
        <h2 id="kamera" className="font-bold">QR okut</h2>
        <div className={`relative mt-3 aspect-square w-full overflow-hidden bg-ink ${camera.kind === "on" || camera.kind === "starting" ? "" : "hidden"}`}>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Kamera görüntüsü" />
          {busy && <div className="absolute inset-0 grid place-items-center bg-ink/60 font-semibold text-paper">Kontrol ediliyor…</div>}
        </div>
        {camera.kind === "error" && (
          <p role="alert" className="mt-3 border-l-4 border-err pl-3 text-sm font-medium text-err">{camera.message}</p>
        )}
        <div className="mt-3">
          {camera.kind === "on" ? (
            <button type="button" className="btn btn-secondary w-full" onClick={stopCamera}>Kamerayı kapat</button>
          ) : (
            <button type="button" className="btn btn-primary w-full" onClick={startCamera} disabled={camera.kind === "starting"}>
              {camera.kind === "starting" ? "Kamera açılıyor…" : camera.kind === "error" ? "Kamerayı tekrar dene" : "Kamerayı aç"}
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="manuel" className="border border-rule bg-paper p-4">
        <h2 id="manuel" className="font-bold">Giriş kodunu elle gir</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void submit("code", code);
          }}
        >
          <label htmlFor="manual-code" className="sr-only">Giriş kodu</label>
          <input
            id="manual-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH-JK"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={14}
            className="field-input font-mono text-xl tracking-widest"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !code.trim()}>Kontrol et</button>
        </form>
      </section>
    </div>
  );
}
