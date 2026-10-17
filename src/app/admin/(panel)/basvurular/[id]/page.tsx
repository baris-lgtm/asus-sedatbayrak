import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { EMAIL_TYPE_LABELS, PARTICIPANT_LABELS, type Application, type EmailLog, type Invitation } from "@/lib/types";
import { EmailStatusText, StatusBadge } from "@/components/admin/status-badge";
import { ActionFeedbackProvider, ActionForm } from "@/components/admin/action-form";
import { DeleteApplicationForm } from "@/components/admin/delete-form";
import {
  approveAction,
  reissueInvitationAction,
  resendInvitationAction,
  retryEmailAction,
  setStatusAction,
} from "@/app/admin/actions";
import { eventContent } from "@/config/event";

const ACTION_LABELS: Record<string, string> = {
  status_change: "Durum değişti",
  approve: "Onaylandı",
  reissue_invitation: "Davetiye yeniden oluşturuldu",
  resend_invitation: "Davetiye tekrar gönderildi",
  check_in: "Giriş yapıldı",
};

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdminPage();

  const [{ data: app }, { data: invitations }, { data: emails }, { data: audit }] = await Promise.all([
    supabase.from("applications").select("*").eq("id", id).maybeSingle<Application>(),
    supabase
      .from("invitations")
      .select("id, application_id, issued_at, revoked_at, revoke_reason, checked_in_at, checked_in_by")
      .eq("application_id", id)
      .order("issued_at", { ascending: false })
      .returns<Invitation[]>(),
    supabase.from("email_logs").select("*").eq("application_id", id).order("created_at", { ascending: false }).returns<EmailLog[]>(),
    supabase
      .from("admin_audit_logs")
      .select("id, action, metadata, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<{ id: number; action: string; metadata: Record<string, unknown>; created_at: string }[]>(),
  ]);
  if (!app) notFound();

  const active = invitations?.find((i) => !i.revoked_at) ?? null;
  const s = app.status;
  const canApprove = ["pending", "reviewing", "waitlisted"].includes(s);
  const canReview = ["pending", "waitlisted", "rejected"].includes(s);
  const canWaitlist = ["pending", "reviewing", "rejected"].includes(s);
  const canReject = ["pending", "reviewing", "waitlisted"].includes(s);
  const canCancel = ["pending", "reviewing", "waitlisted", "approved"].includes(s);
  const motivation = eventContent.additionalQuestion ? app.additional_answers?.[eventContent.additionalQuestion.id] : undefined;

  const rows: [string, React.ReactNode][] = [
    ["E-posta", <a key="e" href={`mailto:${app.email}`} className="break-all underline">{app.email}</a>],
    ["Telefon", <a key="t" href={`tel:${app.phone}`} className="underline tabular-nums">{app.phone}</a>],
    ["Durum", PARTICIPANT_LABELS[app.participant_type]],
    ["Kurum / üniversite", app.institution],
    ["Bölüm / uzmanlık", app.department],
    ["Başvuru tarihi", formatDateTime(app.created_at)],
    ["KVKK metin sürümü", `${app.kvkk_notice_version} (${formatDateTime(app.kvkk_acknowledged_at)})`],
    ["Pazarlama izni", app.marketing_consent ? `Var — ${formatDateTime(app.marketing_consent_at)} (${app.marketing_consent_version ?? "—"})` : "Yok"],
    ["Son inceleme", formatDateTime(app.reviewed_at)],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm underline underline-offset-4">Başvurulara dön</Link>

      <div className="flex flex-wrap items-center gap-4">
        <h1 className="display text-4xl">{app.first_name} {app.last_name}</h1>
        <StatusBadge status={s} />
      </div>

      <ActionFeedbackProvider>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="bilgiler" className="border border-rule bg-paper p-5">
            <h2 id="bilgiler" className="text-lg font-bold">Başvuru bilgileri</h2>
            <dl className="mt-4 divide-y divide-rule">
              {rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-3">
                  <dt className="text-sm text-graphite">{k}</dt>
                  <dd className="sm:col-span-2">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {eventContent.additionalQuestion && (
              <div className="mt-4 border-t-2 border-ink pt-4">
                <p className="text-sm text-graphite">{eventContent.additionalQuestion.label}</p>
                <p className="mt-1 whitespace-pre-line">{motivation || "—"}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="davetiye" className="border border-rule bg-paper p-5">
            <h2 id="davetiye" className="text-lg font-bold">Davetiye</h2>
            {invitations && invitations.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {invitations.map((i) => (
                  <li key={i.id} className={`border-l-4 pl-3 ${i.revoked_at ? "border-rule text-graphite" : "border-ok"}`}>
                    <span className="font-semibold">{i.revoked_at ? "Geçersiz" : i.checked_in_at ? "Kullanıldı" : "Aktif"}</span>
                    {" — "}oluşturma {formatDateTime(i.issued_at)}
                    {i.checked_in_at && <> · giriş {formatDateTime(i.checked_in_at)}</>}
                    {i.revoked_at && <> · iptal {formatDateTime(i.revoked_at)}</>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-graphite">Henüz davetiye oluşturulmadı. Davetiye onayla birlikte otomatik oluşur.</p>
            )}
          </section>

          <section aria-labelledby="epostalar" className="border border-rule bg-paper p-5">
            <h2 id="epostalar" className="text-lg font-bold">E-posta gönderimleri</h2>
            {emails && emails.length > 0 ? (
              <ul className="mt-3 divide-y divide-rule">
                {emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <span className="font-semibold">{EMAIL_TYPE_LABELS[e.email_type]}</span>{" "}
                      <EmailStatusText status={e.status} />
                      <span className="block text-xs text-graphite">
                        {formatDateTime(e.created_at)} · {e.attempt_count} deneme
                        {e.sent_at && <> · gönderim {formatDateTime(e.sent_at)}</>}
                      </span>
                      {e.last_error && <span className="mt-1 block text-xs text-err">{e.last_error}</span>}
                    </div>
                    {e.status === "failed" && (
                      <div className="w-36">
                        <ActionForm action={retryEmailAction} fields={{ logId: e.id }} label="Tekrar dene" pendingLabel="Gönderiliyor…" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-graphite">Kayıtlı e-posta gönderimi yok.</p>
            )}
          </section>

          <section aria-labelledby="gecmis" className="border border-rule bg-paper p-5">
            <h2 id="gecmis" className="text-lg font-bold">İşlem geçmişi</h2>
            {audit && audit.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {audit.map((a) => (
                  <li key={a.id}>
                    <span className="tabular-nums text-graphite">{formatDateTime(a.created_at)}</span> — {ACTION_LABELS[a.action] ?? a.action}
                    {a.action === "status_change" && typeof a.metadata?.to === "string" && <> ({String(a.metadata.from)} → {a.metadata.to})</>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-graphite">Henüz işlem yapılmadı.</p>
            )}
          </section>
        </div>

        <aside aria-labelledby="islemler" className="h-fit space-y-5 border-2 border-ink bg-paper p-5 lg:sticky lg:top-6">
          <h2 id="islemler" className="text-lg font-bold">İşlemler</h2>
          {canApprove && (
            <ActionForm
              action={approveAction}
              fields={{ id }}
              label="Onayla ve davetiye gönder"
              pendingLabel="Onaylanıyor…"
              variant="primary"
              confirmText={`${app.first_name} ${app.last_name} onaylansın ve QR davetiyesi gönderilsin mi?`}
            />
          )}
          {canReview && (
            <ActionForm action={setStatusAction} fields={{ id, status: "reviewing" }} label="İncelemeye al" />
          )}
          {canWaitlist && (
            <ActionForm action={setStatusAction} fields={{ id, status: "waitlisted" }} label="Yedek listeye al" notifyOption="Katılımcıya e-posta gönder" />
          )}
          {canReject && (
            <ActionForm
              action={setStatusAction}
              fields={{ id, status: "rejected" }}
              label="Reddet"
              variant="danger"
              notifyOption="Katılımcıya e-posta gönder"
              confirmText="Başvuru reddedilsin mi?"
            />
          )}
          {s === "approved" && active && (
            <>
              <ActionForm action={resendInvitationAction} fields={{ id }} label="Davetiyeyi tekrar gönder" pendingLabel="Gönderiliyor…" />
              <ActionForm
                action={reissueInvitationAction}
                fields={{ id }}
                label="Yeni QR oluştur"
                confirmText="Mevcut QR kodu geçersiz olacak ve yeni davetiye gönderilecek. Devam edilsin mi?"
              />
            </>
          )}
          {canCancel && (
            <ActionForm
              action={setStatusAction}
              fields={{ id, status: "cancelled" }}
              label={s === "approved" ? "Katılımı iptal et" : "Başvuruyu iptal et"}
              variant="danger"
              notifyOption={s === "approved" ? "Katılımcıya e-posta gönder" : undefined}
              confirmText="Bu işlem geri alınamaz. İptal edilsin mi?"
            />
          )}
          {(s === "checked_in" || s === "cancelled") && (
            <p className="text-sm text-graphite">Bu başvurunun durumu artık değiştirilemez.</p>
          )}
          <DeleteApplicationForm id={id} />
        </aside>
      </div>
      </ActionFeedbackProvider>
    </div>
  );
}
