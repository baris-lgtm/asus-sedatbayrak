import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { listApplications, latestEmailStatus, parseListParams, PAGE_SIZE } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { APPLICATION_STATUSES, EMAIL_TYPE_LABELS, PARTICIPANT_LABELS, STATUS_LABELS, type AdminStats } from "@/lib/types";
import { EmailStatusText, StatusBadge } from "@/components/admin/status-badge";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const rawParams = await searchParams;
  const params = parseListParams(rawParams);
  const deleted = rawParams.silindi === "1";

  const [{ data: statsData }, list] = await Promise.all([
    admin.supabase.rpc("admin_stats"),
    listApplications(admin.supabase, params),
  ]);
  const stats = statsData as AdminStats | null;
  const emails = await latestEmailStatus(admin.supabase, list.rows.map((r) => r.id));
  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  params.page = list.page; // aralık dışı sayfa istendiyse son sayfaya düzeltildi

  const qs = (overrides: Record<string, string | number>) => {
    const u = new URLSearchParams();
    const merged = { q: params.q, status: params.status, sort: params.sort, page: params.page, eposta: params.failedEmail ? "basarisiz" : "", ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== "" && v !== "all" && !(k === "page" && v === 1) && !(k === "sort" && v === "newest")) u.set(k, String(v));
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  const backQs = qs({}).slice(1);
  const detailHref = (id: string) => `/admin/basvurular/${id}${backQs ? `?geri=${encodeURIComponent(backQs)}` : ""}`;

  const exportQs = new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.status !== "all" ? { status: params.status } : {}), ...(params.failedEmail ? { eposta: "basarisiz" } : {}), sort: params.sort });

  const cards: { label: string; value: number | undefined; status?: string; strong?: boolean }[] = [
    { label: "Toplam başvuru", value: stats?.total },
    { label: "İnceleme bekleyen", value: stats ? stats.pending + stats.reviewing : undefined, status: "pending", strong: true },
    { label: "Onaylanan", value: stats ? stats.approved + stats.checked_in : undefined, status: "approved" },
    { label: "Yedek liste", value: stats?.waitlisted, status: "waitlisted" },
    { label: "Reddedilen", value: stats?.rejected, status: "rejected" },
    { label: "Giriş yapan", value: stats?.checked_in, status: "checked_in" },
  ];

  return (
    <div className="space-y-8">
      {deleted && (
        <p role="status" className="border-l-4 border-ok bg-green-50 px-3 py-2 text-sm text-ok">
          Başvuru ve ilişkili tüm kayıtlar kalıcı olarak silindi.
        </p>
      )}
      <section aria-labelledby="ozet">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 id="ozet" className="display text-4xl">Başvurular</h1>
          {stats && (
            <p className="text-sm">
              Kapasite: <strong>{stats.approved + stats.checked_in}</strong> / {stats.capacity} dolu
              {stats.failed_emails > 0 && (
                <Link href="/admin?eposta=basarisiz" className="ml-4 font-semibold text-err underline underline-offset-4">
                  Başarısız e-postaları göster ({stats.failed_emails})
                </Link>
              )}
            </p>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="bg-paper p-4">
              <dt className="text-xs text-graphite">{c.label}</dt>
              <dd className={`mt-1 text-3xl font-bold tabular-nums ${c.strong ? "text-blue" : ""}`}>{c.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Filtreler" className="border border-rule bg-paper p-4">
        {params.failedEmail && (
          <p className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-err">Yalnızca başarısız e-postası olan başvurular gösteriliyor.</span>
            <Link href="/admin" className="underline underline-offset-4">Filtreyi kaldır</Link>
          </p>
        )}
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          {params.failedEmail && <input type="hidden" name="eposta" value="basarisiz" />}
          <div>
            <label htmlFor="q" className="block text-xs font-semibold">Ara</label>
            <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Ad, e-posta, telefon, kurum" className="field-input" />
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-semibold">Durum</label>
            <select id="status" name="status" defaultValue={params.status} className="field-input pr-6">
              <option value="all">Tümü</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="block text-xs font-semibold">Sıralama</label>
            <select id="sort" name="sort" defaultValue={params.sort} className="field-input pr-6">
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary min-h-11">Filtrele</button>
            <a href={`/api/admin/export?${exportQs}`} className="btn btn-secondary min-h-11">CSV indir</a>
          </div>
        </form>
      </section>

      <section aria-labelledby="liste">
        <h2 id="liste" className="sr-only">Başvuru listesi</h2>
        <p className="mb-3 text-sm text-graphite">{list.total} başvuru bulundu</p>

        {list.rows.length === 0 ? (
          <div className="border border-rule bg-paper p-8 text-center">
            <p className="font-semibold">Bu filtrelerle eşleşen başvuru yok.</p>
            {(params.q || params.status !== "all") && (
              <Link href="/admin" className="mt-2 inline-block underline">Filtreleri temizle</Link>
            )}
          </div>
        ) : (
          <>
            {/* Masaüstü tablo */}
            <div className="hidden overflow-x-auto border border-rule bg-paper lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-ink">
                  <tr>
                    {["Ad soyad", "E-posta", "Telefon", "Kurum", "Bölüm", "Başvuru tarihi", "Durum", "E-posta durumu"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((r) => {
                    const e = emails.get(r.id);
                    return (
                      <tr key={r.id} className="border-b border-rule hover:bg-mist">
                        <td className="px-3 py-3">
                          <Link href={detailHref(r.id)} className="font-semibold underline-offset-4 hover:underline">
                            {r.first_name} {r.last_name}
                          </Link>
                          <span className="block text-xs text-graphite">{PARTICIPANT_LABELS[r.participant_type]}</span>
                        </td>
                        <td className="px-3 py-3 break-all">{r.email}</td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.phone}</td>
                        <td className="px-3 py-3">{r.institution}</td>
                        <td className="px-3 py-3">{r.department}</td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatDateTime(r.created_at)}</td>
                        <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-3">
                          {e ? (
                            <>
                              <EmailStatusText status={e.status} />
                              <span className="block text-xs text-graphite">{EMAIL_TYPE_LABELS[e.email_type]}</span>
                            </>
                          ) : (
                            <span className="text-xs text-graphite">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobil kartlar */}
            <ul className="space-y-3 lg:hidden">
              {list.rows.map((r) => {
                const e = emails.get(r.id);
                return (
                  <li key={r.id}>
                    <Link href={detailHref(r.id)} className="block border border-rule bg-paper p-4 active:bg-mist">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold">{r.first_name} {r.last_name}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 break-all text-sm">{r.email}</p>
                      <p className="text-sm tabular-nums">{r.phone}</p>
                      <p className="mt-1 text-sm text-graphite">{[r.institution, r.department].filter(Boolean).join(", ")}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-graphite">
                        <span>{formatDateTime(r.created_at)}</span>
                        {e && <span>E-posta: <EmailStatusText status={e.status} /></span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {totalPages > 1 && (
          <nav aria-label="Sayfalama" className="mt-6 flex items-center justify-between gap-4 text-sm">
            {params.page > 1 ? (
              <Link href={`/admin${qs({ page: params.page - 1 })}`} className="btn btn-secondary min-h-10">Önceki</Link>
            ) : <span />}
            <span>Sayfa {params.page} / {totalPages}</span>
            {params.page < totalPages ? (
              <Link href={`/admin${qs({ page: params.page + 1 })}`} className="btn btn-secondary min-h-10">Sonraki</Link>
            ) : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
