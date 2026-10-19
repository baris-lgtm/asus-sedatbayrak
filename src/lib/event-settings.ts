import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import type { EventSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: EventSettings = {
  event_name: "ASUS × Sedat Bayrak Workshop",
  starts_at: null,
  ends_at: null,
  date_confirmed: false,
  venue_name: null,
  venue_address: null,
  venue_map_url: null,
  transport_info: null,
  venue_confirmed: false,
  capacity: 300,
  applications_open: true,
  kvkk_notice_version: "TASLAK-v0",
  marketing_consent_version: "TASLAK-v0",
  retention_days: 180,
  updated_at: new Date(0).toISOString(),
  info_changed_at: new Date(0).toISOString(),
};

const COLUMNS =
  "event_name, starts_at, ends_at, date_confirmed, venue_name, venue_address, venue_map_url, transport_info, venue_confirmed, capacity, applications_open, kvkk_notice_version, marketing_consent_version, retention_days, updated_at, info_changed_at";

/**
 * Etkinlik ayarları — KESİN. Okunamazsa hata fırlatır.
 * E-posta içerikleri bunu kullanır: ayarlar okunamadığında "tarih duyurulacak"
 * yazan bir davetiye gönderip kişiyi "bilgilendirildi" saymak yerine gönderim
 * başarısız sayılır ve adminden tekrar denenir.
 */
export async function getEventSettingsStrict({ cached = false }: { cached?: boolean } = {}): Promise<EventSettings> {
  const { data, error } = await createPublicClient({ cached })
    .from("event_settings")
    .select(COLUMNS)
    .eq("id", 1)
    .single<EventSettings>();
  if (error || !data) throw new Error(`event_settings okunamadı${error?.code ? ` (${error.code})` : ""}`);
  return data;
}

/**
 * Herkese açık sayfalar için: en çok 60 sn önbellekli (ayar kaydı anında yeniler);
 * okunamazsa güvenli varsayılanlar (her şey "duyurulacak") döner.
 */
export async function getEventSettings(): Promise<EventSettings> {
  try {
    return await getEventSettingsStrict({ cached: true });
  } catch (e) {
    console.error("[event-settings] okunamadı:", e instanceof Error ? e.message : "bilinmeyen hata");
    return DEFAULT_SETTINGS;
  }
}

export { formatEventDate, formatEventTimeRange, formatDateTime } from "@/lib/format";
