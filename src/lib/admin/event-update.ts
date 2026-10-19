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
/** Bu kadar başarısız denemeden sonra alıcı turdan çıkarılır (başvuru detayından elle denenir). */
export const MAX_UPDATE_ATTEMPTS = 3;
const SENDING_STALE_MS = 5 * 60_000;

export async function eventUpdateTargets(supabase: StaffSession["supabase"], version: string) {
  // 1000 satırlık API sınırı için sayfalı okuma (400 kişide tek sayfa).
  type Row = {
    application_id: string;
    invitation_id: string;
    informed: boolean;
    last_status: string | null;
    attempts: number;
    last_attempt_at: string | null;
  };
  const rows: Row[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase.rpc("admin_event_update_targets", { p_version: version }).range(from, from + 999);
    if (error) throw new Error(`Bilgilendirme listesi okunamadı (${error.code})`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const now = Date.now();
  const uninformed = rows.filter((r) => !r.informed);
  const inFlight = (r: Row) =>
    r.last_status === "sending" && r.last_attempt_at !== null && now - new Date(r.last_attempt_at).getTime() < SENDING_STALE_MS;
  const stuck = uninformed.filter((r) => r.last_status === "failed" && r.attempts >= MAX_UPDATE_ATTEMPTS);
  // Gönderilebilir olanlar: önce hiç denenmemiş, sonra az denenmiş — sürekli başarısız olanlar turu tıkamaz.
  const sendable = uninformed
    .filter((r) => !inFlight(r) && !stuck.includes(r))
    .sort((x, y) => x.attempts - y.attempts);
  const toTarget = (r: Row): UpdateTarget => ({ applicationId: r.application_id, invitationId: r.invitation_id });
  return {
    total: rows.length,
    sent: rows.length - uninformed.length,
    /** Henüz bilgilendirilmemiş herkes (sürekli başarısız olanlar dahil) */
    pending: uninformed.map(toTarget),
    /** Bu turda gönderilecek sıradakiler */
    sendable: sendable.map(toTarget),
    /** 3 denemede de başarısız olanlar — başvuru detayından kontrol edilmeli */
    stuck: stuck.length,
  };
}
