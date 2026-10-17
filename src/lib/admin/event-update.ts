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
 * Onaylı (henüz giriş yapmamış), aktif davetiyesi olan katılımcılardan bu sürüm
 * için güncelleme e-postası BAŞARIYLA almamış olanlar. Oturumlu (admin) istemciyle
 * okunur → RLS geçerli.
 */
export async function pendingUpdateTargets(supabase: StaffSession["supabase"], settings: EventSettings) {
  const version = eventInfoVersion(settings);
  const { data: invitations, error } = await supabase
    .from("invitations")
    .select("id, application_id, applications!inner(status)")
    .is("revoked_at", null)
    .eq("applications.status", "approved")
    .returns<{ id: string; application_id: string }[]>();
  if (error) throw new Error(`Davetiyeler okunamadı (${error.code})`);

  // Bilgilendirilmiş sayılır: bu sürüm için güncelleme almış VEYA güncel ayarlar
  // kaydedildikten sonra davetiye e-postası (güncel bilgiyle) almış olanlar.
  const { data: sent } = await supabase
    .from("email_logs")
    .select("application_id, email_type, dedupe_key, sent_at")
    .in("email_type", ["invitation", "invitation_resend", "event_update"])
    .eq("status", "sent")
    .returns<{ application_id: string; email_type: string; dedupe_key: string | null; sent_at: string }[]>();
  const done = new Set<string>();
  const since = new Date(settings.updated_at).getTime();
  for (const r of sent ?? []) {
    const thisVersion = r.email_type === "event_update" && r.dedupe_key?.endsWith(`:${version}`);
    const freshInvitation = r.email_type !== "event_update" && new Date(r.sent_at).getTime() >= since;
    if (thisVersion || freshInvitation) done.add(r.application_id);
  }

  const all = (invitations ?? []).map((i) => ({ applicationId: i.application_id, invitationId: i.id }));
  return {
    version,
    total: all.length,
    sent: all.filter((t) => done.has(t.applicationId)).length,
    pending: all.filter((t) => !done.has(t.applicationId)),
  };
}
