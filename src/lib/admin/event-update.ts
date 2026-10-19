import "server-only";
import { createHash } from "node:crypto";
import type { StaffSession } from "@/lib/auth";
import type { EventSettings } from "@/lib/types";

/**
 * Katılımcıya gösterilen tarih/mekân bilgisinin "sürümü". Bu alanlardan biri
 * değişince yeni sürüm oluşur; her katılımcı her sürüm için en fazla bir
 * güncelleme e-postası alır (email_logs.dedupe_key).
 */
export function eventInfoVersion(s: EventSettings): string {
  const relevant = [
    s.date_confirmed ? s.starts_at : null,
    s.date_confirmed ? s.ends_at : null,
    s.venue_confirmed ? s.venue_name : null,
    s.venue_confirmed ? s.venue_address : null,
    s.venue_confirmed ? s.venue_map_url : null,
    s.venue_confirmed ? s.transport_info : null,
  ];
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 16);
}

export interface UpdateTarget {
  applicationId: string;
  invitationId: string;
}

/**
 * Onaylı (henüz giriş yapmamış), aktif davetiyesi olan katılımcılar ve bu bilgi
 * sürümü için bilgilendirilip bilgilendirilmedikleri. Veritabanında hesaplanır
 * (admin_event_update_targets): PostgREST satır sınırı yok, sıra sabit.
 */
export async function eventUpdateTargets(supabase: StaffSession["supabase"], version: string) {
  // 1000 satırlık API sınırı için sayfalı okuma (400 kişide tek sayfa).
  type Row = { application_id: string; invitation_id: string; informed: boolean };
  const rows: Row[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase.rpc("admin_event_update_targets", { p_version: version }).range(from, from + 999);
    if (error) throw new Error(`Bilgilendirme listesi okunamadı (${error.code})`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const pending: UpdateTarget[] = rows
    .filter((r) => !r.informed)
    .map((r) => ({ applicationId: r.application_id, invitationId: r.invitation_id }));
  return { total: rows.length, sent: rows.length - pending.length, pending };
}
