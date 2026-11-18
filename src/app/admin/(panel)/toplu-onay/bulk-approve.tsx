"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { previewBulkApprove, runBulkApproveStep, type BulkPlan } from "@/app/admin/bulk-actions";

type Failure = { email: string; reason: string };

export function BulkApprove() {
  const [raw, setRaw] = useState("");
  const [plan, setPlan] = useState<BulkPlan | null>(null);
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [progress, setProgress] = useState({ approved: 0, sent: 0, remaining: 0 });
  const [failures, setFailures] = useState<Failure[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string; login?: boolean } | null>(null);
  const stopRef = useRef(false);

  const preview = async () => {
    setBusy("preview");
    setMessage(null);
    setFailures([]);
    try {
      const p = await previewBulkApprove(raw);
      setPlan(p);
      if (!p.ok) setMessage({ ok: false, text: p.message ?? "Önizleme yapılamadı.", login: p.sessionExpired });
    } catch {
      setMessage({ ok: false, text: "Sunucuya ulaşılamadı. Tekrar dene." });
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (!plan) return;
    const total = plan.toApprove + plan.toSend;
    if (!window.confirm(`${plan.toApprove} başvuru onaylanacak ve toplam ${total} kişiye davetiye e-postası gönderilecek. Devam edilsin mi?`)) return;
    setBusy("run");
    setMessage(null);
    stopRef.current = false;
    const failed: Failure[] = [];
    let approved = 0;
    let sent = 0;
    try {
      for (let round = 0; round < 400; round++) {
        if (stopRef.current) {
          setMessage({ ok: true, text: "Durduruldu. Aynı listeyle tekrar başlatırsan kaldığı yerden devam eder." });
          break;
        }
        const step = await runBulkApproveStep(raw, failed.map((f) => f.email));
        approved += step.approved;
        sent += step.sent;
        failed.push(...step.failed);
        setProgress({ approved, sent, remaining: step.remaining });
        setFailures([...failed]);
        if (!step.ok) {
          setMessage({ ok: false, text: step.message ?? "İşlem durdu.", login: step.sessionExpired });
          break;
        }
        if (step.remaining === 0) {
          setMessage({
            ok: failed.length === 0,
            text: failed.length
              ? `Tamamlandı: ${approved} onay, ${sent} davetiye gönderildi. ${failed.length} kişide sorun var (aşağıda).`
              : `Tamamlandı: ${approved} onay, ${sent} davetiye gönderildi.`,
          });
          break;
        }
        if (step.approved === 0 && step.sent === 0 && step.failed.length === 0) {
          setMessage({ ok: false, text: "İlerleme olmadı; birkaç dakika sonra aynı listeyle tekrar dene." });
          break;
        }
      }
    } catch {
      setMessage({ ok: false, text: "Bağlantı kesildi. İşlenenler kaydedildi; sayfayı yenileyip aynı listeyle tekrar başlat." });
    } finally {
      setBusy(null);
      setPlan(await previewBulkApprove(raw).catch(() => plan));
    }
  };

  const overCapacity = plan ? plan.taken + plan.toApprove - plan.capacity : 0;

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold">E-posta listesi</span>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPlan(null);
          }}
          rows={10}
          placeholder={"ayse@ornek.com\nmehmet@ornek.com\n…"}
          className="field-input mt-2 font-mono text-sm"
          disabled={busy === "run"}
        />
        <span className="mt-1 block text-xs text-graphite">Her satıra bir adres ya da Excel&apos;den kopyalanmış bir sütun; diğer metinler yok sayılır.</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary" onClick={preview} disabled={!raw.trim() || busy !== null}>
          {busy === "preview" ? "Kontrol ediliyor…" : "Listeyi kontrol et"}
        </button>
        {busy === "run" && (
          <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
            Durdur
          </button>
        )}
      </div>

      {plan?.ok && (
        <section className="space-y-3 border-2 border-ink bg-paper p-5" aria-live="polite">
          <h2 className="text-lg font-bold">Önizleme</h2>
          <ul className="space-y-1 text-sm">
            <li>Listedeki adres: <strong>{plan.requested}</strong></li>
            <li>Onaylanacak: <strong>{plan.toApprove}</strong></li>
            {plan.toSend > 0 && <li>Onaylı, davetiyesi gönderilecek: <strong>{plan.toSend}</strong></li>}
            <li>Zaten onaylı ve davetiyesi gitmiş: <strong>{plan.done}</strong> (dokunulmaz)</li>
            <li>Kapasite: {plan.taken} / {plan.capacity} dolu</li>
          </ul>
          {overCapacity > 0 && (
            <p className="text-sm font-medium text-err">
              Kapasite yetmiyor: {overCapacity} kişi fazla. Önce <Link href="/admin/ayarlar" className="underline">Etkinlik ayarları</Link>&apos;ndan
              kapasiteyi en az {plan.taken + plan.toApprove} yap.
            </p>
          )}
          {plan.notFound.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-warn">{plan.notFound.length} adres başvurularda bulunamadı (atlanacak)</summary>
              <p className="mt-2 break-words font-mono text-xs">{plan.notFound.join(", ")}</p>
            </details>
          )}
          {plan.blocked.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-warn">{plan.blocked.length} kişi reddedilmiş/iptal edilmiş (atlanacak)</summary>
              <p className="mt-2 break-words font-mono text-xs">{plan.blocked.map((b) => `${b.email} (${b.status})`).join(", ")}</p>
            </details>
          )}
          {plan.toApprove + plan.toSend > 0 ? (
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy !== null || overCapacity > 0}>
              {busy === "run" ? "Gönderiliyor…" : `${plan.toApprove + plan.toSend} kişiyi onayla ve davetiye gönder`}
            </button>
          ) : (
            <p className="text-sm font-medium text-ok">Listedeki herkes zaten onaylı ve davetiyesi gönderilmiş.</p>
          )}
        </section>
      )}

      {(busy === "run" || progress.approved + progress.sent > 0) && (
        <p className="text-sm" role="status">
          İlerleme: <strong>{progress.approved}</strong> onay · <strong>{progress.sent}</strong> davetiye gönderildi
          {busy === "run" && <> · kalan {progress.remaining}</>}
        </p>
      )}

      {message && (
        <p className={`border-l-4 px-3 py-2 text-sm ${message.ok ? "border-ok bg-green-50 text-ok" : "border-err bg-red-50 font-medium text-err"}`}>
          {message.text} {message.login && <Link href="/admin/login" className="underline">Tekrar giriş yap</Link>}
        </p>
      )}

      {failures.length > 0 && (
        <details open className="text-sm">
          <summary className="cursor-pointer font-medium text-err">Sorunlu kişiler ({failures.length})</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {failures.map((f) => (
              <li key={f.email}>
                {f.email} — {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
