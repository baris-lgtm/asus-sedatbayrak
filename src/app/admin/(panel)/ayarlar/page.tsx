import { requireAdminPage } from "@/lib/auth";
import { formatDateTime, toIstanbulLocalInput } from "@/lib/format";
import type { EventSettings } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("event_settings").select("*").eq("id", 1).single<EventSettings>();
  if (!data) return <p>Ayarlar okunamadı.</p>;

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
    </div>
  );
}
