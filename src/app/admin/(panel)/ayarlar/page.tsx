import { requireAdminPage } from "@/lib/auth";
import { formatDateTime, toIstanbulLocalInput } from "@/lib/format";
import type { EventSettings } from "@/lib/types";
import Link from "next/link";
import { SettingsForm } from "./settings-form";
import { ActionFeedbackProvider, ActionForm } from "@/components/admin/action-form";
import { sendEventUpdatesAction } from "@/app/admin/actions";
import { eventInfoVersion, eventUpdateTargets } from "@/lib/admin/event-update";

// Bu sayfadaki server action'ların azami süresi (sn). Bilgilendirme turu (20 e-posta) ~15 sn sürer; Vercel varsayılanı eski projelerde 10–15 sn olabilir.
export const maxDuration = 60;

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("event_settings").select("*").eq("id", 1).single<EventSettings>();
  if (!data) return <p>Ayarlar okunamadı.</p>;
  const canNotify = data.date_confirmed || data.venue_confirmed;
  const progress = canNotify ? await eventUpdateTargets(supabase, eventInfoVersion(data)) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="display text-4xl">Etkinlik ayarları</h1>
        <p className="mt-2 text-sm text-graphite">
          Son güncelleme: {formatDateTime(data.updated_at)}. Değişiklikler ana sayfaya ve bundan sonra gönderilecek
          e-postalara yansır.
        </p>
      </div>
      <SettingsForm
        initial={{
          ...data,
          starts_at_local: toIstanbulLocalInput(data.starts_at),
          ends_at_local: toIstanbulLocalInput(data.ends_at),
        }}
      />
      <section aria-labelledby="bilgilendir" className="space-y-4 border-2 border-ink bg-paper p-5">
        <h2 id="bilgilendir" className="text-lg font-bold">Onaylı katılımcıları bilgilendir</h2>
        <p className="text-sm leading-relaxed text-graphite">
          Davetiyeler tarih veya mekân kesinleşmeden gönderildiyse katılımcılara güncel bilgiyi buradan e-postayla gönder.
          E-postada davetiyeleri ve QR kodları da yer alır; kodlar değişmez. Bilgiyi her değiştirdiğinde yeni bir
          bilgilendirme turu başlar ve herkes her tur için en fazla bir e-posta alır.
        </p>
        <ActionFeedbackProvider>
        {progress ? (
          <>
            <p className="text-sm">
              Bu bilgi sürümü için: <strong>{progress.sent}</strong> / {progress.total} onaylı katılımcı bilgilendirildi
              {progress.pending.length > 0 && <>, <strong>{progress.pending.length}</strong> kişi bekliyor</>}.
            </p>
            {progress.stuck > 0 && (
              <p className="text-sm font-medium text-err">
                {progress.stuck} kişiye 3 denemede de gönderilemedi.{" "}
                <Link href="/admin?eposta=basarisiz" className="underline underline-offset-4">Başarısız e-postaları göster</Link>
              </p>
            )}
            {progress.sendable.length > 0 && (
              <div className="max-w-xs">
                <ActionForm
                  action={sendEventUpdatesAction}
                  fields={{}}
                  label="Bilgilendirme gönder (20 kişilik tur)"
                  pendingLabel="Gönderiliyor…"
                  variant="primary"
                  confirmText={`Bekleyen ${progress.sendable.length} katılımcıdan ilk 20 kişiye güncel tarih/mekân e-postası gönderilsin mi?`}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-medium">Önce tarihi veya mekânı yukarıdan kesinleşmiş olarak kaydet.</p>
        )}
        </ActionFeedbackProvider>
      </section>
    </div>
  );
}
