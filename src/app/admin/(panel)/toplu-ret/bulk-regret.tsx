"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { previewBulkRegret, runBulkRegretStep, sendRegretTestAction, type RegretMode, type RegretPlan } from "@/app/admin/regret-actions";

type Failure = { email: string; reason: string };

function TestSend({ defaultEmail }: { defaultEmail: string }) {
  const [to, setTo] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="space-y-3 rounded border border-rule bg-surface p-5">
      <h2 className="text-lg font-bold">1. Önce kendine test gönder</h2>
      <p className="text-sm text-graphite">E-postanın tasarımını kontrol etmek için. Hiçbir başvuruya dokunmaz; konu başında “[TEST]” yazar.</p>
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            const r = await sendRegretTestAction(to);
            setMsg({ ok: r.ok, text: r.message });
          } catch {
            setMsg({ ok: false, text: "Sunucuya ulaşılamadı. Tekrar dene." });
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Test e-postası adresi"
          placeholder="ornek@mimarliginevrimi.com"
          className="field-input !w-80 max-w-full"
          required
        />
        <button type="submit" className="btn btn-secondary" disabled={busy || !to.trim()}>
          {busy ? "Gönderiliyor…" : "Test e-postası gönder"}
        </button>
      </form>
      {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "font-medium text-err"}`}>{msg.text}</p>}
    </section>
  );
}

export function BulkRegret({ defaultTestEmail }: { defaultTestEmail: string }) {
  const [mode, setMode] = useState<RegretMode>("list");
  const [raw, setRaw] = useState("");
  const [limit, setLimit] = useState(50);
  const [plan, setPlan] = useState<RegretPlan | null>(null);
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [progress, setProgress] = useState({ rejected: 0, sent: 0, remaining: 0 });
  const [failures, setFailures] = useState<Failure[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string; login?: boolean } | null>(null);
  const stopRef = useRef(false);

  const preview = async () => {
    setBusy("preview");
    setMessage(null);
    setFailures([]);
    try {
      const p = await previewBulkRegret(mode, raw);
      setPlan(p);
      if (!p.ok) setMessage({ ok: false, text: p.message ?? "Önizleme yapılamadı.", login: p.sessionExpired });
    } catch {
      setMessage({ ok: false, text: "Sunucuya ulaşılamadı. Tekrar dene." });
    } finally {
      setBusy(null);
    }
  };

  const total = plan ? plan.toReject + plan.toSend : 0;
  const thisRun = Math.min(total, Math.max(1, limit || 1));

  const run = async () => {
    if (!plan) return;
    if (!window.confirm(`Bu seferde ${thisRun} kişi işlenecek: onaylanmamış olanlar reddedilecek ve “Başvurunuz için teşekkür ederiz” e-postası gidecek. Devam edilsin mi?`)) return;
    setBusy("run");
    setMessage(null);
    stopRef.current = false;
    const failed: Failure[] = [];
    let rejected = 0;
    let sent = 0;
    let processed = 0;
    try {
      for (let round = 0; round < 400; round++) {
        const left = thisRun - processed;
        if (left <= 0) {
          setMessage({ ok: failed.length === 0, text: `Bu parça tamamlandı: ${rejected} ret, ${sent} e-posta gönderildi.${failed.length ? ` ${failed.length} kişide sorun var (aşağıda).` : ""} Sıradaki parça için tekrar kontrol et.` });
          break;
        }
        if (stopRef.current) {
          setMessage({ ok: true, text: "Durduruldu. Tekrar başlatırsan kaldığı yerden devam eder." });
          break;
        }
        const step = await runBulkRegretStep(mode, raw, left, failed.map((f) => f.email));
        rejected += step.rejected;
        sent += step.sent;
        processed += step.processed;
        failed.push(...step.failed);
        setProgress({ rejected, sent, remaining: step.remaining });
        setFailures([...failed]);
        if (!step.ok) {
          setMessage({ ok: false, text: step.message ?? "İşlem durdu.", login: step.sessionExpired });
          break;
        }
        if (step.remaining === 0) {
          setMessage({ ok: failed.length === 0, text: `Tamamlandı: ${rejected} ret, ${sent} e-posta gönderildi.${failed.length ? ` ${failed.length} kişide sorun var (aşağıda).` : ""}` });
          break;
        }
        if (step.processed === 0) {
          setMessage({ ok: false, text: "İlerleme olmadı; birkaç dakika sonra tekrar dene." });
          break;
        }
      }
    } catch {
      setMessage({ ok: false, text: "Bağlantı kesildi. İşlenenler kaydedildi; sayfayı yenileyip tekrar başlat." });
    } finally {
      setBusy(null);
      setPlan(await previewBulkRegret(mode, raw).catch(() => plan));
    }
  };

  return (
    <div className="space-y-6">
      <TestSend defaultEmail={defaultTestEmail} />

      <section className="space-y-4 rounded border border-rule bg-surface p-5">
        <h2 className="text-lg font-bold">2. Kimlere gönderilecek?</h2>
        <fieldset className="flex flex-wrap gap-5 text-sm" disabled={busy === "run"}>
          <legend className="sr-only">Hedef</legend>
          {(
            [
              ["list", "Yapıştırdığım liste"],
              ["all", "Onaylanmamış herkes"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === v}
                onChange={() => {
                  setMode(v);
                  setPlan(null);
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {mode === "list" && (
          <label className="block">
            <span className="text-sm font-semibold">E-posta listesi</span>
            <textarea
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setPlan(null);
              }}
              rows={8}
              placeholder={"ayse@ornek.com\nmehmet@ornek.com\n…"}
              className="field-input mt-2 font-mono text-sm"
              disabled={busy === "run"}
            />
            <span className="mt-1 block text-xs text-graphite">Her satıra bir adres ya da Excel&apos;den kopyalanmış bir sütun; diğer metinler yok sayılır.</span>
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={preview} disabled={(mode === "list" && !raw.trim()) || busy !== null}>
          {busy === "preview" ? "Kontrol ediliyor…" : "Kontrol et"}
        </button>
      </section>

      {plan?.ok && (
        <section className="space-y-3 border-2 border-ink bg-paper p-5" aria-live="polite">
          <h2 className="text-lg font-bold">3. Önizleme ve gönderim</h2>
          <ul className="space-y-1 text-sm">
            {mode === "list" && (
              <li>
                Listedeki adres: <strong>{plan.requested}</strong>
              </li>
            )}
            <li>
              Reddedilip e-posta alacak: <strong>{plan.toReject}</strong>
            </li>
            {plan.toSend > 0 && (
              <li>
                Zaten reddedilmiş, yalnızca e-posta alacak: <strong>{plan.toSend}</strong>
              </li>
            )}
            <li>
              Bu e-postayı zaten almış: <strong>{plan.done}</strong> (tekrar gitmez)
            </li>
            <li>
              Onaylı / giriş yapmış: <strong>{plan.protectedCount}</strong> (dokunulmaz)
            </li>
            {plan.cancelled > 0 && <li>İptal edilmiş: {plan.cancelled} (atlanır)</li>}
          </ul>
          {plan.protectedEmails.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-warn">Listede {plan.protectedEmails.length} onaylı kişi var — bunlara dokunulmayacak</summary>
              <p className="mt-2 break-words font-mono text-xs">{plan.protectedEmails.join(", ")}</p>
            </details>
          )}
          {plan.notFound.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-warn">{plan.notFound.length} adres başvurularda bulunamadı (atlanacak)</summary>
              <p className="mt-2 break-words font-mono text-xs">{plan.notFound.join(", ")}</p>
            </details>
          )}
          {total > 0 ? (
            <div className="flex flex-wrap items-end gap-3 pt-2">
              <label className="text-sm">
                <span className="block font-semibold">Bu seferde en fazla</span>
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
                  className="field-input mt-1 !w-28"
                  disabled={busy !== null}
                  aria-label="Bu seferde en fazla kaç kişi"
                />
              </label>
              <button type="button" className="btn btn-primary" onClick={run} disabled={busy !== null}>
                {busy === "run" ? "Gönderiliyor…" : `${thisRun} kişiye gönder`}
              </button>
              {busy === "run" && (
                <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
                  Durdur
                </button>
              )}
              <span className="text-xs text-graphite">Toplam bekleyen: {total}</span>
            </div>
          ) : (
            <p className="text-sm font-medium text-ok">Gönderilecek kimse kalmadı.</p>
          )}
        </section>
      )}

      {(busy === "run" || progress.rejected + progress.sent > 0) && (
        <p className="text-sm" role="status">
          İlerleme: <strong>{progress.rejected}</strong> ret · <strong>{progress.sent}</strong> e-posta gönderildi
          {busy === "run" && <> · toplam kalan {progress.remaining}</>}
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
