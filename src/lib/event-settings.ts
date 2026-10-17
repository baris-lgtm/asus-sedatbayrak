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
};

const COLUMNS =
  "event_name, starts_at, ends_at, date_confirmed, venue_name, venue_address, venue_map_url, transport_info, venue_confirmed, capacity, applications_open, kvkk_notice_version, marketing_consent_version, retention_days, updated_at";

/** Etkinlik ayarları. Okunamazsa güvenli varsayılanlar (her şey "duyurulacak") döner. */
export async function getEventSettings(): Promise<EventSettings> {
  try {
    const { data, error } = await createPublicClient()
      .from("event_settings")
      .select(COLUMNS)
      .eq("id", 1)
      .single<EventSettings>();
    if (error || !data) throw error ?? new Error("event_settings boş");
    return data;
  } catch (e) {
    console.error("[event-settings] okunamadı:", e instanceof Error ? e.message : "bilinmeyen hata");
    return DEFAULT_SETTINGS;
  }
}

export { formatEventDate, formatEventTimeRange, formatDateTime } from "@/lib/format";
