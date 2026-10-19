"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import type { CheckInResult } from "@/lib/types";
import { PARTICIPANT_LABELS } from "@/lib/types";

type Camera = { kind: "off" } | { kind: "starting" } | { kind: "on" } | { kind: "error"; message: string };
type Shown =
  | (CheckInResult & { soft?: boolean })
  | { result: "error"; message: string; sessionExpired?: boolean };

/** Sunucu bu sürede yanıt vermezse istek iptal edilir ve tarayıcı tekrar kullanılabilir olur. */
const REQUEST_TIMEOUT_MS = 8000;
/** Aynı QR içeriği bu süre içinde tekrar yakalanırsa yok sayılır (kamera hâlâ aynı kişiye bakıyor). */
const SAME_CODE_IGNORE_MS = 12_000;
/** Başarılı giriş ekranı bu süre sonra kendiliğinden temizlenir. */
const OK_CLEAR_MS = 4000;

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
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  /** Bu cihazda az önce "ok" alınan girişler (checked_in_at → zaman). */
  const admittedHereRef = useRef(new Map<string, number>());
  const lastNetworkFailureRef = useRef(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camera, setCamera] = useState<Camera>({ kind: "off" });
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      scannerRef.current?.destroy();
      scannerRef.current = null;
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const clearResult = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setShown(null);
    // "Sonraki katılımcı" sonrası aynı QR yeniden okutulabilsin.
    lastScanRef.current = null;
  }, []);

  const submit = useCallback(async (mode: "qr" | "code", value: string) => {
    if (busyRef.current) return;
    const trimmed = value.trim();
    if (mode === "qr") {
      const last = lastScanRef.current;
      if (last && last.value === trimmed && Date.now() - last.at < SAME_CODE_IGNORE_MS) return;
      lastScanRef.current = { value: trimmed, at: Date.now() };
    }
    busyRef.current = true;
    setBusy(true);
    if (clearTimer.current) clearTimeout(clearTimer.current);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let next: Shown;
    try {
      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, value: trimmed }),
        signal: controller.signal,
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 401) {
        next = { result: "error", message: "Oturumun sona ermiş. Tekrar giriş yapman gerekiyor.", sessionExpired: true };
      } else if (!res.ok) {
        lastNetworkFailureRef.current = Date.now();
        next = { result: "error", message: (body.error as string) ?? "Kontrol yapılamadı. Tekrar okut." };
      } else {
        const data = body as unknown as CheckInResult;
        if (data.result === "ok") {
          admittedHereRef.current.set(data.checked_in_at, Date.now());
          next = data;
        } else if (data.result === "already") {
          // Aynı giriş: bu cihaz az önce onayladı, ya da yanıt kaybolduktan sonra tekrar okutuldu.
          const admittedHere = admittedHereRef.current.has(data.checked_in_at);
          const afterLostResponse =
            data.by_me === true && (data.seconds_ago ?? 9999) < 90 && Date.now() - lastNetworkFailureRef.current < 90_000;
          next = { ...data, soft: admittedHere || afterLostResponse };
        } else {
          next = data;
        }
      }
    } catch {
      lastNetworkFailureRef.current = Date.now();
      // Aynı QR'ı hemen tekrar okutabilsinler.
      lastScanRef.current = null;
      next = {
        result: "error",
        message: controller.signal.aborted
          ? "Sunucudan yanıt gelmedi. Tekrar okut; giriş kaydedildiyse sistem bunu gösterir, çift giriş oluşmaz."
          : "İnternet bağlantısı yok. Bağlantıyı kontrol edip tekrar okut.",
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!mountedRef.current) return;
    setShown(next);
    if (next.result === "ok") {
      navigator.vibrate?.(80);
      setCode("");
      clearTimer.current = setTimeout(() => mountedRef.current && setShown((s) => (s === next ? null : s)), OK_CLEAR_MS);
    } else if (!(next.result === "already" && "soft" in next && next.soft)) {
      navigator.vibrate?.([60, 60, 60]);
    }
    // Kısa bekleme: titreşim/okuma çakışmasın.
    setTimeout(() => {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }, 600);
    // Elle girişte klavye kapanmasın: odak kod alanında kalır; kamerada sonuç paneline gider.
    if (mode === "code") codeInputRef.current?.focus();
    else resultRef.current?.focus();
  }, []);

  const startCamera = async () => {
    setCamera({ kind: "starting" });
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!mountedRef.current || !videoRef.current) return;
      if (!(await QrScanner.hasCamera())) throw Object.assign(new Error("no camera"), { name: "NotFoundError" });
      if (!mountedRef.current) return;
      scannerRef.current?.destroy();
      const scanner = new QrScanner(videoRef.current, (r) => void submit("qr", r.data), {
        preferredCamera: "environment",
        returnDetailedScanResult: true,
        maxScansPerSecond: 5,
        // Tüm kare taranır: QR kameraya çok yakın veya kenarda olsa da okunur.
        calculateScanRegion: (v) => {
          const w = v.videoWidth || 640;
          const h = v.videoHeight || 480;
          const scale = Math.min(1, 720 / Math.max(w, h));
          return { x: 0, y: 0, width: w, height: h, downScaledWidth: Math.round(w * scale), downScaledHeight: Math.round(h * scale) };
        },
      });
      scannerRef.current = scanner;
      await scanner.start();
      // Kamera açılırken sayfadan çıkıldıysa akışı hemen kapat.
      if (!mountedRef.current) {
        scanner.destroy();
        return;
      }
      setCamera({ kind: "on" });
    } catch (e) {
      scannerRef.current?.destroy();
      scannerRef.current = null;
      if (mountedRef.current) setCamera({ kind: "error", message: cameraErrorMessage(e) });
    }
  };

  const stopCamera = () => {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamera({ kind: "off" });
  };

  const panel =
    shown &&
    (() => {
      switch (shown.result) {
        case "ok":
          return { tone: "bg-ok text-paper", title: "Giriş onaylandı", body: `${shown.first_name} ${shown.last_name} — ${PARTICIPANT_LABELS[shown.participant_type]}` };
        case "already":
          return shown.soft
            ? {
                tone: "bg-blue text-paper",
                title: "Bu katılımcı az önce giriş yaptı",
                body: `${shown.first_name} ${shown.last_name} — giriş ${timeTr(shown.checked_in_at)} itibarıyla geçerli. Tekrar okutmaya gerek yok.`,
              }
            : {
                tone: "bg-amber-400 text-ink",
                title: "Bu katılımcının girişi daha önce yapılmış",
                body: `${shown.first_name} ${shown.last_name} — ilk giriş: ${timeTr(shown.checked_in_at)}. Tekrar giriş verme; kayıt masasına yönlendir.`,
              };
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
      {!online && (
        <p role="alert" className="border-2 border-err bg-red-50 px-4 py-3 font-semibold text-err">
          İnternet bağlantısı yok. Bağlantı gelene kadar giriş kontrol edilemez.
        </p>
      )}

      <div ref={resultRef} tabIndex={-1} aria-live="assertive" className="outline-none">
        {panel && (
          <div className={`p-5 ${panel.tone}`}>
            <p className="text-2xl font-bold leading-tight">{panel.title}</p>
            <p className="mt-2 text-lg">{panel.body}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={clearResult} className="min-h-11 border-2 border-current px-4 py-2 font-semibold">
                Sonraki katılımcı
              </button>
              {shown?.result === "error" && "sessionExpired" in shown && shown.sessionExpired && (
                <Link href="/admin/login" className="inline-flex min-h-11 items-center border-2 border-current px-4 py-2 font-semibold">
                  Giriş yap
                </Link>
              )}
            </div>
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
            ref={codeInputRef}
            id="manual-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH-JK"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            maxLength={14}
            className="field-input font-mono text-xl tracking-widest"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !code.trim()}>
            {busy ? "Kontrol…" : "Kontrol et"}
          </button>
        </form>
      </section>
    </div>
  );
}
