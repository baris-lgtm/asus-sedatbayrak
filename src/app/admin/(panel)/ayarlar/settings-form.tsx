"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionState } from "@/app/admin/actions";
import type { EventSettings } from "@/lib/types";

type Initial = EventSettings & { starts_at_local: string; ends_at_local: string };

function Text({ name, label, defaultValue, hint, type = "text", ...rest }: { name: string; label: string; defaultValue: string | number | null; hint?: string; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} className="field-input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-graphite">{hint}</p>}
    </div>
  );
}

function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 accent-ink" />
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-graphite">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  return (
    <form action={action} className="space-y-8">
      <fieldset className="space-y-5 border border-rule bg-paper p-5">
        <legend className="px-1 text-lg font-bold">Genel</legend>
        <Text name="event_name" label="Etkinlik adı" defaultValue={initial.event_name} required maxLength={120} />
        <Text name="capacity" label="Kapasite" type="number" min={1} max={5000} defaultValue={initial.capacity} hint="Onaylar bu sayıyı aşamaz (sunucu ve veritabanında kontrol edilir)." />
        <Check name="applications_open" label="Başvurular açık" defaultChecked={initial.applications_open} hint="Kapatıldığında form gizlenir ve yeni kayıt reddedilir." />
      </fieldset>

      <fieldset className="space-y-5 border border-rule bg-paper p-5">
        <legend className="px-1 text-lg font-bold">Tarih</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="starts_at" label="Başlangıç (İstanbul saati)" type="datetime-local" defaultValue={initial.starts_at_local} />
          <Text name="ends_at" label="Bitiş (İstanbul saati)" type="datetime-local" defaultValue={initial.ends_at_local} />
        </div>
        <Check name="date_confirmed" label="Tarih kesinleşti" defaultChecked={initial.date_confirmed} hint="İşaretlenmeden tarih sayfada ve e-postalarda gösterilmez." />
      </fieldset>

      <fieldset className="space-y-5 border border-rule bg-paper p-5">
        <legend className="px-1 text-lg font-bold">Mekân</legend>
        <Text name="venue_name" label="Mekân adı" defaultValue={initial.venue_name} maxLength={160} />
        <Text name="venue_address" label="Adres" defaultValue={initial.venue_address} maxLength={400} />
        <Text name="venue_map_url" label="Harita bağlantısı" type="url" defaultValue={initial.venue_map_url} placeholder="https://maps.google.com/..." />
        <div>
          <label htmlFor="transport_info" className="block text-sm font-semibold">Ulaşım bilgileri</label>
          <textarea id="transport_info" name="transport_info" rows={4} maxLength={2000} defaultValue={initial.transport_info ?? ""} className="field-input resize-y" />
        </div>
        <Check name="venue_confirmed" label="Mekân kesinleşti" defaultChecked={initial.venue_confirmed} hint="İşaretlenmeden mekân sayfada ve e-postalarda gösterilmez." />
      </fieldset>

      <fieldset className="space-y-5 border border-rule bg-paper p-5">
        <legend className="px-1 text-lg font-bold">KVKK ve veri saklama</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="kvkk_notice_version" label="KVKK aydınlatma metni sürümü" defaultValue={initial.kvkk_notice_version} maxLength={40} hint="Metin değiştiğinde sürümü artır; yeni başvurularda bu sürüm kaydedilir." />
          <Text name="marketing_consent_version" label="Pazarlama izni metni sürümü" defaultValue={initial.marketing_consent_version} maxLength={40} />
        </div>
        <Text name="retention_days" label="Saklama süresi (gün)" type="number" min={1} max={3650} defaultValue={initial.retention_days} hint="Bu süreden eski başvurular otomatik silme görevinde kalıcı olarak silinir. Hukuk onaylı süreyi gir." />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
        <p aria-live="polite" className={`text-sm ${state.ok === false ? "font-medium text-err" : "text-ok"}`}>{state.message}</p>
      </div>
    </form>
  );
}
