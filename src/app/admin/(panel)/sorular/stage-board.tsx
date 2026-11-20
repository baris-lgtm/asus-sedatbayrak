"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  listStageQuestions,
  mergeStageAction,
  resetStageAction,
  setStageOpenAction,
  setStageStatusAction,
  updateStageBodyAction,
  type StageList,
  type StageQuestion,
  type StageResult,
  type StageStatus,
} from "@/app/admin/stage-actions";

type Tab = "new" | "selected" | "asked" | "archived";
const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "Gelen" },
  { key: "selected", label: "Moderatöre iletilen" },
  { key: "asked", label: "Soruldu" },
  { key: "archived", label: "Elenen" },
];
const POLL_MS = 8000;

function time(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

export function StageBoard({
  initial,
  formUrl,
  qrSvgHref,
  qrPngHref,
  isAdmin,
}: {
  initial: StageList;
  formUrl: string;
  qrSvgHref: string;
  qrPngHref: string;
  isAdmin: boolean;
}) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("new");
  const [checked, setChecked] = useState<string[]>([]);
  const [notice, setNotice] = useState<StageResult | null>(initial.ok ? null : initial);
  const [pending, start] = useTransition();
  const editing = useRef(false);

  const refresh = useCallback(async () => {
    const next = await listStageQuestions();
    if (next.ok) setData(next);
    else setNotice(next);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (!editing.current && !document.hidden) void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const run = (fn: () => Promise<StageResult>, clear = true) =>
    start(async () => {
      const r = await fn();
      setNotice(r.ok && !r.message ? null : r);
      if (r.ok && clear) setChecked([]);
      await refresh();
    });

  const { byStatus, children } = useMemo(() => {
    const byStatus: Record<StageStatus, StageQuestion[]> = { new: [], selected: [], asked: [], archived: [], merged: [] };
    const children = new Map<string, StageQuestion[]>();
    for (const q of data.questions) {
      byStatus[q.status].push(q);
      if (q.merged_into) children.set(q.merged_into, [...(children.get(q.merged_into) ?? []), q]);
    }
    // Moderatör sırası: iletiliş zamanına göre
    byStatus.selected.sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at));
    byStatus.asked.sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at));
    return { byStatus, children };
  }, [data.questions]);

  const list = byStatus[tab];
  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const switchTab = (t: Tab) => {
    setTab(t);
    setChecked([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Sahne soruları</h1>
          <p className="mt-2 text-sm leading-relaxed text-graphite">
            Katılımcılar <a className="underline" href="/soru" target="_blank">{formUrl.replace(/^https?:\/\//, "")}</a> adresinden soru gönderir; liste{" "}
            {POLL_MS / 1000} saniyede bir yenilenir. Tekrar eden soruları işaretleyip <b>Birleştir</b>; seçtiklerini <b>Moderatöre ilet</b>. Moderatör
            iletilen soruları <Link className="underline" href="/admin/sorular/sahne" target="_blank">moderatör ekranında</Link> büyük yazıyla görür.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isAdmin && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (data.open && !confirm("Soru alımı kapatılsın mı? Form yeni soru kabul etmez.")) return;
              run(() => setStageOpenAction(!data.open), false);
            }}
            className={`btn ${data.open ? "btn-secondary" : "btn-primary"}`}
          >
            {data.open ? "Soru alımını kapat" : "Soru alımını aç"}
          </button>
          )}
          <span className="text-xs text-graphite">
            Durum: <b className={data.open ? "text-ok" : "text-err"}>{data.open ? "Açık" : "Kapalı"}</b> ·{" "}
            <a className="underline" href={qrPngHref} download="mimarligin-evrimi-soru-qr.png">QR (PNG)</a> ·{" "}
            <a className="underline" href={qrSvgHref} download="mimarligin-evrimi-soru-qr.svg">QR (SVG)</a>
          </span>
        </div>
      </div>

      <div role="tablist" aria-label="Soru durumu" className="flex flex-wrap gap-2 border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-ink font-semibold" : "border-transparent text-graphite hover:text-ink"}`}
          >
            {t.label} <span className="tabular-nums text-graphite">({byStatus[t.key].length})</span>
          </button>
        ))}
      </div>

      {notice?.message && (
        <p role="status" className={`text-sm ${notice.ok ? "text-ok" : "text-err"}`}>
          {notice.message}
          {notice.sessionExpired && (
            <>
              {" "}
              <a className="underline" href="/admin/login">Giriş yap</a>
            </>
          )}
        </p>
      )}

      {checked.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded border border-rule bg-surface p-3 shadow-sm">
          <span className="mr-2 text-sm">
            <b>{checked.length}</b> soru işaretli
          </span>
          {checked.length > 1 && (
            <button type="button" disabled={pending} className="btn btn-secondary" onClick={() => run(() => mergeStageAction(checked[0], checked.slice(1)))}>
              Birleştir (ilk işaretlenen ana soru)
            </button>
          )}
          {tab !== "selected" && (
            <button type="button" disabled={pending} className="btn btn-primary" onClick={() => run(() => setStageStatusAction(checked, "selected"))}>
              Moderatöre ilet
            </button>
          )}
          {tab !== "archived" && (
            <button type="button" disabled={pending} className="btn btn-secondary" onClick={() => run(() => setStageStatusAction(checked, "archived"))}>
              Ele
            </button>
          )}
          <button type="button" className="text-sm underline" onClick={() => setChecked([])}>
            Seçimi temizle
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded border border-dashed border-rule p-8 text-center text-sm text-graphite">Bu bölümde soru yok.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              tab={tab}
              merged={children.get(q.id) ?? []}
              checkedIndex={checked.indexOf(q.id)}
              onToggle={() => toggle(q.id)}
              pending={pending}
              run={run}
              editing={editing}
            />
          ))}
        </ul>
      )}

      {isAdmin && <ResetStage count={data.questions.length} run={run} pending={pending} />}
    </div>
  );
}

function QuestionCard({
  q,
  tab,
  merged,
  checkedIndex,
  onToggle,
  pending,
  run,
  editing,
}: {
  q: StageQuestion;
  tab: Tab;
  merged: StageQuestion[];
  checkedIndex: number;
  onToggle: () => void;
  pending: boolean;
  run: (fn: () => Promise<StageResult>, clear?: boolean) => void;
  editing: React.RefObject<boolean>;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const checked = checkedIndex >= 0;
  const setEditing = (v: string | null) => {
    setEdit(v);
    editing.current = v !== null;
  };

  return (
    <li className={`rounded border bg-surface p-4 ${checked ? "border-ink ring-1 ring-ink" : "border-rule"}`}>
      <div className="flex gap-3">
        <label className="mt-0.5 flex shrink-0 items-start">
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-5 w-5" aria-label="Soruyu işaretle" />
        </label>
        <div className="min-w-0 flex-1">
          {edit === null ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{q.body}</p>
          ) : (
            <textarea
              value={edit}
              onChange={(e) => setEdit(e.target.value)}
              rows={3}
              maxLength={600}
              className="field-input w-full"
              aria-label="Soru metni"
              autoFocus
            />
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite">
            <span className="font-medium text-ink">{q.author_name ?? "İsimsiz"}</span>
            <span>{time(q.created_at)}</span>
            {checked && checkedIndex === 0 && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper">Ana soru</span>}
            {merged.length > 0 && (
              <button type="button" onClick={() => setOpen((v) => !v)} className="rounded bg-mist px-1.5 py-0.5 font-medium text-ink" aria-expanded={open}>
                +{merged.length} benzer soru
              </button>
            )}
          </p>
          {open && merged.length > 0 && (
            <ul className="mt-3 space-y-2 border-l-2 border-rule pl-3">
              {merged.map((m) => (
                <li key={m.id} className="text-sm">
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 text-xs text-graphite">
                    {m.author_name ?? "İsimsiz"} · {time(m.created_at)} ·{" "}
                    <button type="button" disabled={pending} className="underline" onClick={() => run(() => setStageStatusAction([m.id], "new"), false)}>
                      Ayır
                    </button>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2 text-sm">
        {edit === null ? (
          <>
            <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => setEditing(q.body)}>
              Düzenle
            </button>
            {tab === "new" && (
              <>
                <button type="button" disabled={pending} className="btn btn-secondary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "archived"), false)}>
                  Ele
                </button>
                <button type="button" disabled={pending} className="btn btn-primary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "selected"), false)}>
                  Moderatöre ilet
                </button>
              </>
            )}
            {tab === "selected" && (
              <>
                <button type="button" disabled={pending} className="btn btn-secondary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "new"), false)}>
                  Geri al
                </button>
                <button type="button" disabled={pending} className="btn btn-primary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "asked"), false)}>
                  Soruldu
                </button>
              </>
            )}
            {tab === "asked" && (
              <button type="button" disabled={pending} className="btn btn-secondary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "selected"), false)}>
                Moderatöre geri gönder
              </button>
            )}
            {tab === "archived" && (
              <button type="button" disabled={pending} className="btn btn-secondary !min-h-9 !px-3" onClick={() => run(() => setStageStatusAction([q.id], "new"), false)}>
                Geri al
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => setEditing(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              className="btn btn-primary !min-h-9 !px-3"
              onClick={() => {
                const body = edit;
                setEditing(null);
                run(() => updateStageBodyAction(q.id, body), false);
              }}
            >
              Kaydet
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function ResetStage({ count, run, pending }: { count: number; run: (fn: () => Promise<StageResult>, clear?: boolean) => void; pending: boolean }) {
  const [text, setText] = useState("");
  return (
    <section className="rounded border border-rule bg-surface p-5">
      <h2 className="text-lg font-semibold">Tüm soruları sil</h2>
      <p className="mt-1 text-sm text-graphite">Prova sonrasında veya etkinlik bitince tüm soruları ({count}) kalıcı olarak siler. Geri alınamaz.</p>
      <form
        className="mt-3 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text;
          setText("");
          run(() => resetStageAction(t));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="SIFIRLA" className="field-input !w-40" aria-label="Soruları silmek için SIFIRLA yaz" />
        <button type="submit" disabled={pending || count === 0} className="btn btn-secondary">
          Tüm soruları sil
        </button>
      </form>
    </section>
  );
}
